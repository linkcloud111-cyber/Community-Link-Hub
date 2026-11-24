import { jsonResponse, type Env } from "../email-change/_common";
import {
  firestoreDeleteDoc,
  firestoreGetDoc,
  firestoreListCollection,
  firestoreSetDoc,
} from "../email-change/_firestore";
import type { CmsAuditEntry, CmsStorageAdapter } from "../../../src/server/cms-core";

export function createCloudflareCmsStorage(env: Env): CmsStorageAdapter {
  return {
    async getDoc(path: string) {
      return firestoreGetDoc(path, env);
    },
    async setDoc(path: string, data: Record<string, any>, merge = true) {
      await firestoreSetDoc(path, data, env, merge);
    },
    async deleteDoc(path: string) {
      await firestoreDeleteDoc(path, env);
    },
    async listCollection(collectionPath: string, limit = 200) {
      return firestoreListCollection(collectionPath, env, limit);
    },
    async addAuditLog(entry: CmsAuditEntry) {
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await firestoreSetDoc(`audit_logs/${auditId}`, entry, env, false);
    },
  };
}

export function cfCmsOptions(methods = "GET, POST, PUT, DELETE, OPTIONS"): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function cfResultResponse(res: { status: number; body: any }): Response {
  return jsonResponse(res.body, res.status);
}
