import { jsonResponse, errorResponse, type Env } from "../../email-change/_common";
import { getServiceAccount, getGoogleAccessToken } from "../../email-change/_firebase-admin";
import { firestoreGetDoc, firestoreSetDoc, firestoreDeleteDoc, firestoreListCollection } from "../../email-change/_firestore";
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
  const reason = body.reason || "Webmaster administrative deletion";

  if (!targetUid) {
    return errorResponse("Missing or invalid 'uid' parameter", 400);
  }

  // Strict Webmaster Protection: Webmaster accounts cannot be deleted via the user management API
  if (targetUid === callerUid) {
    return errorResponse("Self-Protection: You cannot delete your active Webmaster account.", 403);
  }

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
      return errorResponse("Forbidden: Cannot delete the last remaining active Webmaster account in the system.", 403);
    }

    return errorResponse("Security Protection: Webmaster accounts cannot be deleted through the user management API.", 403);
  }

  const nowIso = new Date().toISOString();
  const userData = await firestoreGetDoc(`users/${targetUid}`, env);

  const targetEmail = userData?.email || "";
  const targetPhone = userData?.phone || "";
  const targetAccountUid = userData?.accountUid || targetUid;

  // 1. Delete from Firebase Auth if service account is available
  const sa = getServiceAccount(env);
  let authDeleted = false;
  if (sa) {
    try {
      const accessToken = await getGoogleAccessToken(sa);
      await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ localId: targetUid }),
      });
      authDeleted = true;
    } catch (e: any) {
      console.warn("[Cloudflare Admin] Auth delete warning:", e.message);
    }
  }

  // 2. Write tombstone to /deletedAccounts
  await firestoreSetDoc(
    `deletedAccounts/${targetUid}`,
    {
      uid: targetUid,
      accountUid: targetAccountUid,
      email: targetEmail,
      phone: targetPhone,
      deletedAt: nowIso,
      deletedBy: callerEmail,
      deletedByUid: callerUid,
      reason,
    },
    env,
    false
  );

  // 3. Remove user document and indexes
  await firestoreDeleteDoc(`users/${targetUid}`, env);
  if (targetEmail) {
    await firestoreDeleteDoc(`emailIndex/${targetEmail.toLowerCase()}`, env);
  }
  if (targetPhone) {
    await firestoreDeleteDoc(`mobileIndex/${targetPhone}`, env);
  }

  // 4. Write audit log
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await firestoreSetDoc(
    `auditLogs/${auditId}`,
    {
      action: "USER_DELETED_ADMIN",
      targetUid,
      actorUid: callerUid,
      details: {
        targetAccountUid,
        targetEmail,
        actorEmail: callerEmail,
        reason,
      },
      timestamp: nowIso,
    },
    env,
    false
  );

  return jsonResponse({
    success: true,
    uid: targetUid,
    authDeleted,
    timestamp: nowIso,
  });
}
