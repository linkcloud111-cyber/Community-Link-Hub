import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import { firestoreGetDoc, firestoreSetDoc } from "../email-change/_firestore";
import { requireWebmasterAuth } from "./_admin-common";

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

  if (!body || typeof body !== "object") {
    return errorResponse("Expected settings JSON object", 400);
  }

  // Prevent privilege escalation keys
  const forbiddenKeys = [
    "role",
    "roles",
    "uid",
    "accountUid",
    "isAdmin",
    "isWebmaster",
    "permissions",
  ];
  for (const k of forbiddenKeys) {
    delete body[k];
  }

  // Validate JSON-LD
  if (typeof body.structuredDataJson === "string" && body.structuredDataJson.trim().length > 0) {
    try {
      JSON.parse(body.structuredDataJson);
    } catch (parseErr: any) {
      return errorResponse(`Invalid JSON syntax in structuredDataJson: ${parseErr.message}`, 400);
    }
  }

  // Sanitize URLs to prevent XSS / malicious schemes
  const urlFields = [
    "canonicalUrl",
    "ogImage",
    "twitterCardImage",
    "siteLogo",
    "favicon",
    "homepageBanner",
    "footerLogo",
    "googleMapUrl",
    "facebookUrl",
    "instagramUrl",
    "telegramUrl",
    "whatsappUrl",
    "youtubeUrl",
    "linkedinUrl",
    "twitterUrl",
    "redditUrl",
    "githubUrl",
  ];

  for (const field of urlFields) {
    if (typeof body[field] === "string" && body[field].trim().length > 0) {
      const val = body[field].trim().toLowerCase();
      if (val.startsWith("javascript:") || val.startsWith("data:") || val.startsWith("vbscript:")) {
        return errorResponse(`Disallowed URL protocol in field '${field}'`, 400);
      }
    }
  }

  try {
    const nowIso = new Date().toISOString();
    const updatePayload = {
      ...body,
      updatedAt: nowIso,
      updatedByUid: auth.uid,
      updatedByEmail: auth.email,
    };

    // 1. Update settings/site
    await firestoreSetDoc("settings/site", updatePayload, env, true);

    // 2. Sync legal copy to settings/staticPages
    const staticSync: Record<string, any> = { updatedAt: nowIso };
    if (typeof body.privacyPolicyContent === "string") staticSync.privacy = body.privacyPolicyContent;
    if (typeof body.termsContent === "string") staticSync.terms = body.termsContent;
    if (typeof body.dmcaContent === "string") staticSync.dmca = body.dmcaContent;
    if (typeof body.disclaimerContent === "string") staticSync.disclaimer = body.disclaimerContent;
    await firestoreSetDoc("settings/staticPages", staticSync, env, true);

    // 3. Append audit log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await firestoreSetDoc(
      `audit_logs/${auditId}`,
      {
        action: "Settings Changed",
        details: "Updated platform settings & SEO configuration via Webmaster API",
        actorUid: auth.uid || "webmaster",
        actorEmail: auth.email || "webmaster@linkcloud.in",
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
