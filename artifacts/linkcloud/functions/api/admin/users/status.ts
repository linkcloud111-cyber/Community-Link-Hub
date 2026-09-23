import { jsonResponse, errorResponse, type Env } from "../../email-change/_common";
import { getServiceAccount, getGoogleAccessToken } from "../../email-change/_firebase-admin";
import { firestoreGetDoc, firestoreSetDoc, firestoreListCollection } from "../../email-change/_firestore";
import { requireWebmasterAuth } from "../_admin-common";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) {
    return auth.response!;
  }

  const callerUid = auth.uid!;
  const callerEmail = auth.email || "webmaster@linkcloud.in";

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const targetUid = (body.uid || "").trim();
  const status = (body.status || "").trim();

  if (!targetUid) {
    return errorResponse("Missing or invalid 'uid' parameter", 400);
  }

  // Strict Webmaster Protection: Webmaster status cannot be altered via normal user management
  if (
    targetUid === callerUid &&
    (status === "suspended" || status === "banned" || status === "deleted" || status === "inactive")
  ) {
    return errorResponse("Self-Protection: You cannot suspend, ban, or deactivate your active Webmaster account.", 403);
  }

  // Check target user isn't webmaster
  const targetWebmasterDoc = await firestoreGetDoc(`webmaster/${targetUid}`, env);
  const targetUserDoc = await firestoreGetDoc(`users/${targetUid}`, env);

  const isTargetWebmaster = Boolean(
    (targetWebmasterDoc && (targetWebmasterDoc.role === "webmaster" || targetWebmasterDoc.active === true)) ||
    (targetUserDoc && targetUserDoc.role === "webmaster")
  );

  if (isTargetWebmaster) {
    // Last-Webmaster safeguard check
    const activeWebmasters = await firestoreListCollection("webmaster", env, 50);
    const activeCount = activeWebmasters.filter(
      (doc) => doc.active !== false && (doc.role === "webmaster" || !doc.role)
    ).length;

    if (activeCount <= 1) {
      return errorResponse("Forbidden: Cannot deactivate or alter the status of the last remaining active Webmaster account in the system.", 403);
    }

    return errorResponse("Security Protection: You cannot alter the status of a protected Webmaster account.", 403);
  }

  const shouldDisable = status === "suspended" || status === "banned";
  const nowIso = new Date().toISOString();

  // 1. Update Firebase Auth user state if service account is configured
  const sa = getServiceAccount(env);
  let authUpdated = false;
  if (sa) {
    try {
      const accessToken = await getGoogleAccessToken(sa);
      await fetch("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          localId: targetUid,
          disableUser: shouldDisable,
        }),
      });
      authUpdated = true;
    } catch (e: any) {
      console.warn("[Cloudflare Admin] Auth disable error:", e.message);
    }
  }

  // 2. Update Firestore user document
  await firestoreSetDoc(
    `users/${targetUid}`,
    {
      status,
      updatedAt: nowIso,
      statusUpdatedBy: callerEmail,
      statusUpdatedAt: nowIso,
    },
    env,
    true
  );

  // 3. Write audit log
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await firestoreSetDoc(
    `auditLogs/${auditId}`,
    {
      action: shouldDisable ? "USER_SUSPENDED" : "USER_STATUS_UPDATED",
      targetUid,
      actorUid: callerUid,
      details: { newStatus: status, disabled: shouldDisable, actorEmail: callerEmail },
      timestamp: nowIso,
    },
    env,
    false
  );

  return jsonResponse({
    success: true,
    uid: targetUid,
    status,
    disabled: shouldDisable,
    authUpdated,
    timestamp: nowIso,
  });
}
