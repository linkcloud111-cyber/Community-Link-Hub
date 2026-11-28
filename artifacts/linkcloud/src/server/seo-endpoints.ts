import type { IncomingMessage, ServerResponse } from "http";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./admin-api";
import {
  buildDynamicRobotsTxt,
  buildDynamicSitemapResult,
  buildDynamicSitemapXml,
  resolveDynamicSeoOrigin,
  type DynamicSitemapResult,
  type SeoStorageAdapter,
} from "../lib/seo-builder";
import firebaseConfig from "../../firebase-applet-config.json";

export {
  buildDynamicRobotsTxt,
  buildDynamicSitemapResult,
  buildDynamicSitemapXml,
  resolveDynamicSeoOrigin,
  type DynamicSitemapResult,
  type SeoStorageAdapter,
};

// Public Firestore REST fallback for local Vite dev when Firebase Admin SDK credentials are absent
function parseRestFirestoreValue(valObj: any): any {
  if (!valObj || typeof valObj !== "object") return undefined;
  if ("stringValue" in valObj) return valObj.stringValue;
  if ("integerValue" in valObj) return parseInt(valObj.integerValue, 10);
  if ("doubleValue" in valObj) return parseFloat(valObj.doubleValue);
  if ("booleanValue" in valObj) return valObj.booleanValue;
  if ("timestampValue" in valObj) return valObj.timestampValue;
  if ("nullValue" in valObj) return null;
  if ("mapValue" in valObj) return parseRestFirestoreFields(valObj.mapValue.fields);
  if ("arrayValue" in valObj) {
    const vals = Array.isArray(valObj.arrayValue?.values) ? valObj.arrayValue.values : [];
    return vals.map((item: any) => parseRestFirestoreValue(item));
  }
  return undefined;
}

function parseRestFirestoreFields(fields: any): Record<string, any> {
  if (!fields) return {};
  const result: Record<string, any> = {};
  for (const [key, valObj] of Object.entries(fields as Record<string, any>)) {
    const converted = parseRestFirestoreValue(valObj);
    if (converted !== undefined) result[key] = converted;
  }
  return result;
}

async function runRestFieldQuery(
  base: string,
  collectionId: string,
  fieldPath: string,
  value: string | boolean,
  limit = 500
): Promise<Array<{ id: string; [key: string]: any }>> {
  const res = await fetch(`${base}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: "EQUAL",
            value: typeof value === "boolean" ? { booleanValue: value } : { stringValue: value },
          },
        },
        limit,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Firestore REST runQuery ${collectionId} failed: ${res.status}`);
  }
  const rows: any = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r: any) => r && r.document)
    .map((r: any) => {
      const d = r.document;
      const id = d.name ? String(d.name).split("/").pop() || "" : "";
      return { id, ...parseRestFirestoreFields(d.fields) };
    });
}

function mergeUniqueDocs(
  a: Array<{ id: string; [key: string]: any }>,
  b: Array<{ id: string; [key: string]: any }>
): Array<{ id: string; [key: string]: any }> {
  const map = new Map<string, { id: string; [key: string]: any }>();
  for (const doc of [...a, ...b]) {
    if (doc?.id) map.set(doc.id, doc);
  }
  return Array.from(map.values());
}

function createRestFallbackStorage(projectId: string): SeoStorageAdapter {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  return {
    async getDoc(docPath: string) {
      const res = await fetch(`${base}/${docPath}`);
      if (!res.ok) return null;
      const data: any = await res.json();
      if (!data.fields) return null;
      const id = data.name ? String(data.name).split("/").pop() || "" : "";
      return { id, ...parseRestFirestoreFields(data.fields) };
    },
    async listCollection(collectionPath: string, limitCount = 500) {
      const collected: Array<{ id: string; [key: string]: any }> = [];
      let pageToken = "";
      while (collected.length < limitCount) {
        const batch = Math.min(300, limitCount - collected.length);
        const qs = new URLSearchParams({ pageSize: String(batch) });
        if (pageToken) qs.set("pageToken", pageToken);
        const res = await fetch(`${base}/${collectionPath}?${qs.toString()}`);
        if (res.status === 404) return collected;
        if (!res.ok) {
          throw new Error(`Firestore REST LIST ${collectionPath} failed: ${res.status}`);
        }
        const data: any = await res.json();
        if (Array.isArray(data.documents) && data.documents.length > 0) {
          for (const d of data.documents) {
            const id = d.name ? String(d.name).split("/").pop() || "" : "";
            collected.push({ id, ...parseRestFirestoreFields(d.fields) });
          }
        }
        if (!data.nextPageToken || !Array.isArray(data.documents) || data.documents.length === 0) {
          break;
        }
        pageToken = data.nextPageToken;
      }
      return collected;
    },
    async queryApprovedGroups() {
      return runRestFieldQuery(base, "groups", "status", "approved", 5000);
    },
    async queryDisabledLocations() {
      const [s1, s2, d1, d2, c1, c2] = await Promise.all([
        runRestFieldQuery(base, "states", "enabled", false, 200).catch(() => []),
        runRestFieldQuery(base, "states", "status", "disabled", 200).catch(() => []),
        runRestFieldQuery(base, "districts", "enabled", false, 500).catch(() => []),
        runRestFieldQuery(base, "districts", "status", "disabled", 500).catch(() => []),
        runRestFieldQuery(base, "cities", "enabled", false, 500).catch(() => []),
        runRestFieldQuery(base, "cities", "status", "disabled", 500).catch(() => []),
      ]);
      return {
        states: mergeUniqueDocs(s1, s2),
        districts: mergeUniqueDocs(d1, d2),
        cities: mergeUniqueDocs(c1, c2),
      };
    },
  };
}

function createNodeSeoStorage(): SeoStorageAdapter {
  const app = getFirebaseAdminApp();
  const firestore = app ? getFirestore(app) : null;
  if (!firestore) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      firebaseConfig.projectId ||
      "linkcloud-5bb2f";
    return createRestFallbackStorage(projectId);
  }
  const queryDisabled = async (col: string, lim: number) => {
    const [q1, q2] = await Promise.all([
      firestore.collection(col).where("enabled", "==", false).limit(lim).get().catch(() => null),
      firestore.collection(col).where("status", "==", "disabled").limit(lim).get().catch(() => null),
    ]);
    const list1 = q1 ? q1.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
    const list2 = q2 ? q2.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
    return mergeUniqueDocs(list1, list2);
  };
  return {
    async getDoc(path: string) {
      const snap = await firestore.doc(path).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },
    async listCollection(collectionPath: string, limit = 500) {
      const snap = await firestore.collection(collectionPath).limit(limit).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async queryApprovedGroups() {
      const snap = await firestore
        .collection("groups")
        .where("status", "==", "approved")
        .limit(5000)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async queryDisabledLocations() {
      const [states, districts, cities] = await Promise.all([
        queryDisabled("states", 200),
        queryDisabled("districts", 500),
        queryDisabled("cities", 500),
      ]);
      return { states, districts, cities };
    },
  };
}

const SEO_CACHE_TTL_MS = 5 * 60 * 1000;
const robotsCache = new Map<string, { value: string; expiresAt: number }>();
const sitemapCache = new Map<string, { value: DynamicSitemapResult; expiresAt: number }>();

function readHeader(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0] || null;
  return raw || null;
}

export async function handleDynamicRobotsRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  const hostHeader = readHeader(req, "host");
  const envOrigin = process.env.APP_URL || process.env.VITE_APP_URL || null;
  const cacheKey = `${hostHeader || ""}|${envOrigin || ""}`;
  const cached = robotsCache.get(cacheKey);
  let txt: string;

  if (cached && cached.expiresAt > Date.now()) {
    txt = cached.value;
  } else {
    txt = await buildDynamicRobotsTxt(createNodeSeoStorage(), {
      envOrigin,
      hostHeader,
      forwardedProto: readHeader(req, "x-forwarded-proto"),
    });
    robotsCache.set(cacheKey, { value: txt, expiresAt: Date.now() + SEO_CACHE_TTL_MS });
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(req.method === "HEAD" ? "" : txt);
}

export async function handleDynamicSitemapRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  const hostHeader = readHeader(req, "host");
  const envOrigin = process.env.APP_URL || process.env.VITE_APP_URL || null;
  const cacheKey = `${hostHeader || ""}|${envOrigin || ""}`;
  const cached = sitemapCache.get(cacheKey);

  let result: DynamicSitemapResult;
  if (cached && cached.expiresAt > Date.now()) {
    result = cached.value;
  } else {
    result = await buildDynamicSitemapResult(createNodeSeoStorage(), {
      envOrigin,
      hostHeader,
      forwardedProto: readHeader(req, "x-forwarded-proto"),
    });
    if (result.groupQueryFailed) {
      if (cached) {
        result = cached.value;
      } else {
        res.statusCode = 503;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Retry-After", "300");
        res.setHeader("Cache-Control", "no-store");
        res.end(req.method === "HEAD" ? "" : "Sitemap temporarily unavailable.");
        return;
      }
    } else {
      sitemapCache.set(cacheKey, { value: result, expiresAt: Date.now() + SEO_CACHE_TTL_MS });
    }
  }

  if (result.indexingDisabled) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    res.end(req.method === "HEAD" ? "" : "Sitemap unavailable while indexing is disabled.");
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(req.method === "HEAD" ? "" : result.xml);
}
