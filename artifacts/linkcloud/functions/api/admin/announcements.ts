import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import {
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreDeleteDoc,
  firestoreListCollection,
} from "../email-change/_firestore";
import { requireWebmasterAuth } from "./_admin-common";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function validateAnnouncement(body: any): { valid: boolean; error?: string; cleaned?: any } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Expected JSON object" };
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { valid: false, error: "Title is required" };
  if (title.length > 100) return { valid: false, error: "Title exceeds 100 chars" };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return { valid: false, error: "Message is required" };
  if (message.length > 500) return { valid: false, error: "Message exceeds 500 chars" };

  const validTypes = ["info", "announcement", "important", "warning", "maintenance", "success"];
  const type = validTypes.includes(body.type) ? body.type : "announcement";

  const validDisplayModes = ["banner", "ticker", "static", "scrolling"];
  const displayMode = validDisplayModes.includes(body.displayMode) ? body.displayMode : "banner";

  const priority = typeof body.priority === "number" && !isNaN(body.priority)
    ? Math.max(1, Math.min(100, Math.floor(body.priority)))
    : 10;

  const enabled = body.enabled !== false;
  const dismissible = body.dismissible !== false;

  let actionLabel = typeof body.actionLabel === "string" ? body.actionLabel.trim() : undefined;
  if (actionLabel && actionLabel.length > 50) {
    return { valid: false, error: "Action button label exceeds 50 chars" };
  }

  let actionUrl = typeof body.actionUrl === "string" ? body.actionUrl.trim() : undefined;
  if (actionUrl) {
    if (actionUrl.length > 300) return { valid: false, error: "Action URL exceeds 300 chars" };
    const lower = actionUrl.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:") ||
      lower.startsWith("file:")
    ) {
      return { valid: false, error: "Disallowed protocol in action URL" };
    }
  }

  let startAt = body.startAt ? String(body.startAt).trim() : null;
  let endAt = body.endAt ? String(body.endAt).trim() : null;

  if (startAt && isNaN(new Date(startAt).getTime())) {
    return { valid: false, error: "Invalid startAt date" };
  }
  if (endAt) {
    const endT = new Date(endAt).getTime();
    if (isNaN(endT)) return { valid: false, error: "Invalid endAt date" };
    if (startAt && endT <= new Date(startAt).getTime()) {
      return { valid: false, error: "End date must be after start date" };
    }
  }

  return {
    valid: true,
    cleaned: {
      title,
      message,
      type,
      displayMode,
      priority,
      enabled,
      dismissible,
      actionLabel: actionLabel || null,
      actionUrl: actionUrl || null,
      startAt: startAt || null,
      endAt: endAt || null,
    },
  };
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) return auth.response!;

  try {
    const items = await firestoreListCollection("announcements", env, 100);
    items.sort((a, b) => {
      const pDiff = (b.priority ?? 10) - (a.priority ?? 10);
      if (pDiff !== 0) return pDiff;
      return String(a.id).localeCompare(String(b.id));
    });

    return jsonResponse({ success: true, announcements: items });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to list announcements", 500);
  }
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) return auth.response!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const validation = validateAnnouncement(body);
  if (!validation.valid) return errorResponse(validation.error!, 400);

  try {
    const nowIso = new Date().toISOString();
    const id = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const docData = {
      id,
      ...validation.cleaned!,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: auth.uid || "webmaster",
      updatedBy: auth.uid || "webmaster",
    };

    await firestoreSetDoc(`announcements/${id}`, docData, env, false);

    // Audit log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await firestoreSetDoc(
      `audit_logs/${auditId}`,
      {
        action: "Announcement Created",
        details: `Created site-wide announcement: "${docData.title}" [${docData.type}, ${docData.displayMode}, priority ${docData.priority}]`,
        actorUid: auth.uid || "webmaster",
        actorEmail: auth.email || "webmaster@linkcloud.in",
        timestamp: nowIso,
      },
      env,
      false
    );

    return jsonResponse({
      success: true,
      message: "Announcement created successfully.",
      id,
      announcement: docData,
    });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to create announcement", 500);
  }
}

export async function onRequestPut(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) return auth.response!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const id = body.id;
  if (!id) return errorResponse("Announcement ID is required", 400);

  const validation = validateAnnouncement(body);
  if (!validation.valid) return errorResponse(validation.error!, 400);

  try {
    const nowIso = new Date().toISOString();
    const existing = await firestoreGetDoc(`announcements/${id}`, env);
    if (!existing) return errorResponse("Announcement not found", 404);

    const updateData = {
      ...validation.cleaned!,
      updatedAt: nowIso,
      updatedBy: auth.uid || "webmaster",
    };

    await firestoreSetDoc(`announcements/${id}`, updateData, env, true);

    // Audit log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await firestoreSetDoc(
      `audit_logs/${auditId}`,
      {
        action: "Announcement Updated",
        details: `Updated site-wide announcement "${updateData.title}" (ID: ${id})`,
        actorUid: auth.uid || "webmaster",
        actorEmail: auth.email || "webmaster@linkcloud.in",
        timestamp: nowIso,
      },
      env,
      false
    );

    return jsonResponse({
      success: true,
      message: "Announcement updated successfully.",
      announcement: { id, ...updateData },
    });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to update announcement", 500);
  }
}

export async function onRequestDelete(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) return auth.response!;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("Announcement ID is required", 400);

  try {
    const existing = await firestoreGetDoc(`announcements/${id}`, env);
    if (!existing) return errorResponse("Announcement not found", 404);

    await firestoreDeleteDoc(`announcements/${id}`, env);

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await firestoreSetDoc(
      `audit_logs/${auditId}`,
      {
        action: "Announcement Deleted",
        details: `Deleted site-wide announcement "${existing.title || id}" (ID: ${id})`,
        actorUid: auth.uid || "webmaster",
        actorEmail: auth.email || "webmaster@linkcloud.in",
        timestamp: new Date().toISOString(),
      },
      env,
      false
    );

    return jsonResponse({ success: true, message: "Announcement deleted successfully." });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to delete announcement", 500);
  }
}
