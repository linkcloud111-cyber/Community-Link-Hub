import type { IncomingMessage, ServerResponse } from "http";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp, verifyWebmasterToken } from "./admin-api";
import {
  handleAdminCmsAutoSeed,
  handleAdminCmsRefresh,
  handleAdminCreateFaq,
  handleAdminCreateHelpArticle,
  handleAdminDeleteCmsPage,
  handleAdminDeleteFaq,
  handleAdminDeleteHelpArticle,
  handleAdminGetCmsPages,
  handleAdminGetCmsVersions,
  handleAdminListFaqs,
  handleAdminListHelpArticles,
  handleAdminPublishCmsPage,
  handleAdminRestoreCmsVersion,
  handleAdminSaveCmsDraft,
  handleAdminUnpublishCmsPage,
  handleAdminUpdateFaq,
  handleAdminUpdateHelpArticle,
  handlePublicGetCmsPage,
  handlePublicGetFaqs,
  handlePublicGetHelpArticles,
  type CmsAuditEntry,
  type CmsAuthActor,
  type CmsStorageAdapter,
} from "./cms-core";

export type VerifyWebmasterFn = (
  req: IncomingMessage
) => Promise<{
  valid: boolean;
  uid?: string;
  email?: string;
  error?: string;
  statusCode?: number;
}>;

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

function parseQuery(req: IncomingMessage): URLSearchParams {
  const rawUrl = req.url || "/";
  const idx = rawUrl.indexOf("?");
  return new URLSearchParams(idx >= 0 ? rawUrl.slice(idx + 1) : "");
}

export function createFirebaseAdminCmsAdapter(): CmsStorageAdapter | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  const firestore = getFirestore(app);

  return {
    async getDoc(path: string) {
      const snap = await firestore.doc(path).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...(snap.data() || {}) };
    },
    async setDoc(path: string, data: Record<string, any>, merge = true) {
      if (merge) {
        await firestore.doc(path).set(data, { merge: true });
      } else {
        await firestore.doc(path).set(data);
      }
    },
    async deleteDoc(path: string) {
      await firestore.doc(path).delete();
    },
    async listCollection(collectionPath: string, limitCount = 200) {
      const snap = await firestore.collection(collectionPath).limit(limitCount).get();
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    },
    async addAuditLog(entry: CmsAuditEntry) {
      await firestore.collection("audit_logs").add(entry);
    },
  };
}

export interface CmsHttpRuntimeDeps {
  getStorage?: () => CmsStorageAdapter | null;
  verifyWebmaster?: VerifyWebmasterFn;
}

export function createCmsNodeHandlers(deps?: CmsHttpRuntimeDeps) {
  const resolveStorage = deps?.getStorage || createFirebaseAdminCmsAdapter;
  const verifyAuth = deps?.verifyWebmaster || verifyWebmasterToken;

  async function requireAdmin(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<{ actor: CmsAuthActor; storage: CmsStorageAdapter } | null> {
    const authResult = await verifyAuth(req);
    if (!authResult.valid) {
      sendJson(
        res,
        { success: false, error: authResult.error || "Unauthorized" },
        authResult.statusCode || 401
      );
      return null;
    }
    const storage = resolveStorage();
    if (!storage) {
      sendJson(
        res,
        { success: false, error: "Firestore Admin service unavailable." },
        503
      );
      return null;
    }
    return {
      actor: {
        uid: authResult.uid || "webmaster",
        email: authResult.email || "webmaster@linkcloud.in",
      },
      storage,
    };
  }

  return {
    async handlePublicCmsPagesGet(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const storage = resolveStorage();
      if (!storage) {
        return sendJson(res, { success: false, error: "CMS storage unavailable." }, 503);
      }
      try {
        const params = parseQuery(req);
        const result = await handlePublicGetCmsPage(storage, params.get("slug"), {
          includeDrafts: params.get("includeDrafts"),
        });
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "CMS read failed" }, 500);
      }
    },

    async handlePublicFaqsGet(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const storage = resolveStorage();
      if (!storage) {
        return sendJson(res, { success: false, error: "FAQ storage unavailable." }, 503);
      }
      try {
        const result = await handlePublicGetFaqs(storage);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to load FAQs" }, 500);
      }
    },

    async handlePublicHelpArticlesGet(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const storage = resolveStorage();
      if (!storage) {
        return sendJson(res, { success: false, error: "Help storage unavailable." }, 503);
      }
      try {
        const result = await handlePublicGetHelpArticles(storage);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(
          res,
          { success: false, error: err?.message || "Failed to load Help Center articles" },
          500
        );
      }
    },

    async handleAdminCmsPagesGet(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        const params = parseQuery(req);
        const result = await handleAdminGetCmsPages(ctx.storage, params.get("slug"));
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to load CMS pages" }, 500);
      }
    },

    async handleAdminCmsDraftSave(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "PUT" && req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use PUT or POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminSaveCmsDraft(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to save draft" }, 500);
      }
    },

    async handleAdminCmsPublish(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminPublishCmsPage(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to publish page" }, 500);
      }
    },

    async handleAdminCmsUnpublish(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminUnpublishCmsPage(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to unpublish page" }, 500);
      }
    },

    async handleAdminCmsDelete(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "DELETE" && req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use DELETE or POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const params = parseQuery(req);
      const body = (await parseBody(req)) || {};
      const slug = body.slug || params.get("slug");
      const confirmDeletePublished =
        body.confirmDeletePublished === true ||
        params.get("confirmDeletePublished") === "true";
      try {
        const result = await handleAdminDeleteCmsPage(ctx.storage, ctx.actor, {
          slug,
          confirmDeletePublished,
        });
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to delete page" }, 500);
      }
    },

    async handleAdminCmsVersions(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        const params = parseQuery(req);
        const result = await handleAdminGetCmsVersions(ctx.storage, params.get("slug"));
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to load versions" }, 500);
      }
    },

    async handleAdminCmsRestore(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminRestoreCmsVersion(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Failed to restore version" }, 500);
      }
    },

    async handleAdminCmsSeed(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = (await parseBody(req)) || {};
      try {
        const result = await handleAdminCmsAutoSeed(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Auto Seed failed" }, 500);
      }
    },

    async handleAdminCmsRefresh(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST" && req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST or GET." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        const result = await handleAdminCmsRefresh(ctx.storage, ctx.actor);
        return sendJson(res, result.body, result.status);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Refresh failed" }, 500);
      }
    },

    async handleAdminFaqs(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        if (req.method === "GET") {
          const result = await handleAdminListFaqs(ctx.storage);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "POST") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminCreateFaq(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "PUT" || req.method === "PATCH") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminUpdateFaq(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "DELETE") {
          const params = parseQuery(req);
          const body = (await parseBody(req)) || {};
          const id = params.get("id") || body.id;
          const result = await handleAdminDeleteFaq(ctx.storage, ctx.actor, id);
          return sendJson(res, result.body, result.status);
        }
        return sendJson(res, { success: false, error: "Method not allowed." }, 405);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "FAQ request failed" }, 500);
      }
    },

    async handleAdminHelpArticles(req: IncomingMessage, res: ServerResponse) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        if (req.method === "GET") {
          const result = await handleAdminListHelpArticles(ctx.storage);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "POST") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminCreateHelpArticle(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "PUT" || req.method === "PATCH") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminUpdateHelpArticle(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "DELETE") {
          const params = parseQuery(req);
          const body = (await parseBody(req)) || {};
          const id = params.get("id") || body.id;
          const result = await handleAdminDeleteHelpArticle(ctx.storage, ctx.actor, id);
          return sendJson(res, result.body, result.status);
        }
        return sendJson(res, { success: false, error: "Method not allowed." }, 405);
      } catch (err: any) {
        return sendJson(res, { success: false, error: err?.message || "Help article request failed" }, 500);
      }
    },
  };
}

const defaultHandlers = createCmsNodeHandlers();

export const handlePublicCmsPagesGetRequest = defaultHandlers.handlePublicCmsPagesGet;
export const handlePublicFaqsGetRequest = defaultHandlers.handlePublicFaqsGet;
export const handlePublicHelpArticlesGetRequest = defaultHandlers.handlePublicHelpArticlesGet;
export const handleAdminCmsPagesGetRequest = defaultHandlers.handleAdminCmsPagesGet;
export const handleAdminCmsDraftSaveRequest = defaultHandlers.handleAdminCmsDraftSave;
export const handleAdminCmsPublishRequest = defaultHandlers.handleAdminCmsPublish;
export const handleAdminCmsUnpublishRequest = defaultHandlers.handleAdminCmsUnpublish;
export const handleAdminCmsDeleteRequest = defaultHandlers.handleAdminCmsDelete;
export const handleAdminCmsVersionsRequest = defaultHandlers.handleAdminCmsVersions;
export const handleAdminCmsRestoreRequest = defaultHandlers.handleAdminCmsRestore;
export const handleAdminCmsSeedRequest = defaultHandlers.handleAdminCmsSeed;
export const handleAdminCmsRefreshRequest = defaultHandlers.handleAdminCmsRefresh;
export const handleAdminFaqsRequest = defaultHandlers.handleAdminFaqs;
export const handleAdminHelpArticlesRequest = defaultHandlers.handleAdminHelpArticles;
