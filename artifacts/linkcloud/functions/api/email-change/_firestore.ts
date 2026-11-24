import { getServiceAccount, type Env } from "./_common";
import { getGoogleAccessToken } from "./_firebase-admin";

function getProjectId(env: Env): string {
  const sa = getServiceAccount(env);
  return (
    sa?.project_id ||
    env.FIREBASE_PROJECT_ID ||
    env.VITE_FIREBASE_PROJECT_ID ||
    "linkcloud-5bb2f"
  );
}

// Convert Firestore REST field value to native JS value
function fromFirestoreValue(valObj: any): any {
  if (!valObj || typeof valObj !== "object") return undefined;
  if ("stringValue" in valObj) return valObj.stringValue;
  if ("integerValue" in valObj) return parseInt(valObj.integerValue, 10);
  if ("doubleValue" in valObj) return parseFloat(valObj.doubleValue);
  if ("booleanValue" in valObj) return valObj.booleanValue;
  if ("timestampValue" in valObj) return valObj.timestampValue;
  if ("nullValue" in valObj) return null;
  if ("mapValue" in valObj) return fromFirestoreFields(valObj.mapValue.fields);
  if ("arrayValue" in valObj) {
    const vals = Array.isArray(valObj.arrayValue?.values) ? valObj.arrayValue.values : [];
    return vals.map((item: any) => fromFirestoreValue(item));
  }
  return undefined;
}

// Convert Firestore REST field object to native JS value
export function fromFirestoreFields(fields: any): any {
  if (!fields) return {};
  const result: any = {};
  for (const [key, valObj] of Object.entries(fields as Record<string, any>)) {
    const converted = fromFirestoreValue(valObj);
    if (converted !== undefined) {
      result[key] = converted;
    }
  }
  return result;
}

function toFirestoreValue(val: any): any {
  if (val === undefined) return undefined;
  if (val === null) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)).filter((v) => v !== undefined),
      },
    };
  }
  if (typeof val === "object") {
    return { mapValue: { fields: toFirestoreFields(val) } };
  }
  return undefined;
}

// Convert native JS object to Firestore REST fields object
export function toFirestoreFields(obj: Record<string, any>): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    const converted = toFirestoreValue(val);
    if (converted !== undefined) {
      fields[key] = converted;
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

export async function firestoreAddDoc(
  collectionPath: string,
  data: Record<string, any>,
  env: Env
): Promise<string> {
  const projectId = getProjectId(env);
  const serviceAccount = getServiceAccount(env);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (serviceAccount) {
    const token = await getGoogleAccessToken(serviceAccount);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore POST ${collectionPath} failed: ${res.status} ${text}`);
  }

  const docData: any = await res.json();
  return docData.name ? String(docData.name).split("/").pop() || "" : "";
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

export async function firestoreRunQueryField(
  collectionId: string,
  fieldPath: string,
  op: "EQUAL" | "IN",
  value: string | string[],
  env: Env,
  limit = 10
): Promise<Array<{ id: string; [key: string]: any }>> {
  const projectId = getProjectId(env);
  const serviceAccount = getServiceAccount(env);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (serviceAccount) {
    const token = await getGoogleAccessToken(serviceAccount);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const filterValue =
    op === "IN"
      ? {
          arrayValue: {
            values: (Array.isArray(value) ? value : [value]).slice(0, 10).map((v) => ({
              stringValue: String(v),
            })),
          },
        }
      : { stringValue: String(value) };

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op,
            value: filterValue,
          },
        },
        limit,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore runQuery ${collectionId} failed: ${res.status} ${text}`);
  }

  const rows: any = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row: any) => row && row.document)
    .map((row: any) => {
      const docData = row.document;
      const id = docData.name ? String(docData.name).split("/").pop() || "" : "";
      return { id, ...fromFirestoreFields(docData.fields) };
    });
}

export async function firestoreIncrementField(
  docPath: string,
  fieldPath: string,
  delta: number,
  env: Env
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

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  const fullDocName = `projects/${projectId}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: fullDocName,
            fieldTransforms: [
              {
                fieldPath,
                increment: { integerValue: String(delta) },
              },
            ],
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore increment ${docPath}.${fieldPath} failed: ${res.status} ${text}`);
  }
}

