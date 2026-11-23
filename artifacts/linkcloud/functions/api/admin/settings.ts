import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import { firestoreGetDoc, firestoreSetDoc } from "../email-change/_firestore";
import { requireWebmasterAuth } from "./_admin-common";
import { validateAdminSettingsPayload } from "../../../src/lib/settings-validation";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) {
    return auth.response!;
  }

  try {
    const settings = await firestoreGetDoc("settings/site", env);
    return jsonResponse({
      success: true,
      settings: settings || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to load settings", 500);
  }
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return handleUpdateSettings(context);
}

export async function onRequestPut(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return handleUpdateSettings(context);
}

async function handleUpdateSettings(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) {
    return auth.response!;
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const validation = validateAdminSettingsPayload(body);
  if (!validation.valid || !validation.sanitized) {
    return errorResponse(validation.error || "Invalid settings payload", 400);
  }

  try {
    const nowIso = new Date().toISOString();
    const updatePayload = {
      ...validation.sanitized,
      updatedAt: nowIso,
      updatedByUid: auth.uid,
      updatedByEmail: auth.email,
    };

    // 1. Update settings/site (merge: true preserves any legacy compatibility fields)
    await firestoreSetDoc("settings/site", updatePayload, env, true);

    // 2. Append audit log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await firestoreSetDoc(
      `audit_logs/${auditId}`,
      {
        action: "Settings Changed",
        details: "Updated platform settings & global SEO configuration via Webmaster API",
        adminUid: auth.uid || "webmaster",
        adminEmail: auth.email || "webmaster@linkcloud.in",
        actorUid: auth.uid || "webmaster",
        actorEmail: auth.email || "webmaster@linkcloud.in",
        createdAt: nowIso,
        timestamp: nowIso,
      },
      env,
      false
    );

    return jsonResponse({
      success: true,
      message: "Webmaster settings saved successfully.",
      updatedAt: nowIso,
    });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to save settings", 500);
  }
}
