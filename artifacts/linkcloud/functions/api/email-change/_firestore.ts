import { getServiceAccount, type Env } from "./_common";
import { getGoogleAccessToken } from "./_firebase-admin";

function getProjectId(env: Env): string {
  const sa = getServiceAccount(env);
  return (
    sa?.project_id ||
    env.FIREBASE_PROJECT_ID ||
    env.VITE_FIREBASE_PROJECT_ID ||
    "linkcloud-app"
  );
}

// Convert Firestore REST field object to native JS value
export function fromFirestoreFields(fields: any): any {
  if (!fields) return {};
  const result: any = {};
  for (const [key, valObj] of Object.entries(fields as Record<string, any>)) {
    if ("stringValue" in valObj) result[key] = valObj.stringValue;
    else if ("integerValue" in valObj) result[key] = parseInt(valObj.integerValue, 10);
    else if ("doubleValue" in valObj) result[key] = parseFloat(valObj.doubleValue);
    else if ("booleanValue" in valObj) result[key] = valObj.booleanValue;
    else if ("timestampValue" in valObj) result[key] = valObj.timestampValue;
    else if ("nullValue" in valObj) result[key] = null;
    else if ("mapValue" in valObj) result[key] = fromFirestoreFields(valObj.mapValue.fields);
  }
  return result;
}

// Convert native JS object to Firestore REST fields object
export function toFirestoreFields(obj: Record<string, any>): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val === null) fields[key] = { nullValue: null };
    else if (typeof val === "string") fields[key] = { stringValue: val };
    else if (typeof val === "boolean") fields[key] = { booleanValue: val };
    else if (typeof val === "number") {
      if (Number.isInteger(val)) fields[key] = { integerValue: val.toString() };
      else fields[key] = { doubleValue: val };
    } else if (typeof val === "object") {
      fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
    }
  }
  return fields;
}

export async function firestoreGetDoc(
  path: string,
  env: Env
): Promise<{ id: string; [key: string]: any } | null> {
  const projectId = getProjectId(env);
  const serviceAccount = getServiceAccount(env);
  const headers: Record<string, string> = {};

  if (serviceAccount) {
    const token = await getGoogleAccessToken(serviceAccount);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore GET ${path} failed: ${res.status} ${text}`);
  }

  const docData: any = await res.json();
  const id = docData.name ? docData.name.split("/").pop() : path.split("/").pop();
  return { id, ...fromFirestoreFields(docData.fields) };
}

export async function firestoreSetDoc(
  path: string,
  data: Record<string, any>,
  env: Env,
  merge = true
): Promise<void> {
  const projectId = getProjectId(env);
  const serviceAccount = getServiceAccount(env);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (serviceAccount) {
    const token = await getGoogleAccessToken(serviceAccount);
    headers["Authorization"] = `Bearer ${token}`;
  }

  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  if (merge) {
    const updateMasks = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`);
    url += `?${updateMasks.join("&")}`;
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore PATCH ${path} failed: ${res.status} ${text}`);
  }
}

export async function firestoreDeleteDoc(path: string, env: Env): Promise<void> {
  const projectId = getProjectId(env);
  const serviceAccount = getServiceAccount(env);
  const headers: Record<string, string> = {};

  if (serviceAccount) {
    const token = await getGoogleAccessToken(serviceAccount);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Firestore DELETE ${path} failed: ${res.status} ${text}`);
  }
}

export async function firestoreListCollection(
  collectionPath: string,
  env: Env,
  pageSize = 100
): Promise<Array<{ id: string; [key: string]: any }>> {
  const projectId = getProjectId(env);
  const serviceAccount = getServiceAccount(env);
  const headers: Record<string, string> = {};

  if (serviceAccount) {
    const token = await getGoogleAccessToken(serviceAccount);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?pageSize=${pageSize}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore LIST ${collectionPath} failed: ${res.status} ${text}`);
  }

  const data: any = await res.json();
  if (!data.documents || !Array.isArray(data.documents)) return [];
  return data.documents.map((docData: any) => {
    const id = docData.name ? docData.name.split("/").pop() : "";
    return { id, ...fromFirestoreFields(docData.fields) };
  });
}

