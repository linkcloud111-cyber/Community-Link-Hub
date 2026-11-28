import { normalizeIndianMobileNumber } from "../../../src/lib/group-validation";
import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import {
  getServiceAccount,
  getGoogleAccessToken,
  verifyFirebaseIdToken,
} from "../email-change/_firebase-admin";
import {
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreDeleteDoc,
  firestoreRunQueryField,
} from "../email-change/_firestore";

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

  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    return errorResponse("Authentication required.", 401);
  }

  let decoded: { uid: string; email?: string };
  try {
    decoded = await verifyFirebaseIdToken(idToken, env);
  } catch {
    return errorResponse("Invalid or expired authentication token.", 401);
  }

  const uid = decoded.uid;
  const serviceAccount = getServiceAccount(env);
  if (!serviceAccount) {
    return errorResponse("Account deletion service is temporarily unavailable.", 503);
  }

  try {
    const webmasterDoc = await firestoreGetDoc(`webmaster/${uid}`, env);
    const userDoc = await firestoreGetDoc(`users/${uid}`, env);
    if (
      uid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
      userDoc?.role === "webmaster" ||
      (webmasterDoc && webmasterDoc.active !== false)
    ) {
      return errorResponse("Security Protection: Webmaster accounts cannot be self-deleted.", 403);
    }

    const email = typeof userDoc?.email === "string" ? userDoc.email.trim().toLowerCase() : (decoded.email || "").trim().toLowerCase();
    const phone = typeof userDoc?.phone === "string" ? userDoc.phone.trim() : "";
    const accountUid = userDoc?.accountUid || uid;
    const nowIso = new Date().toISOString();

    // 1. Anonymize groups submitted by this user (directory preserves groups without PII)
    const userGroups = await firestoreRunQueryField("groups", "submittedBy", "EQUAL", uid, env, 100);
    for (const g of userGroups) {
      await firestoreSetDoc(
        `groups/${g.id}`,
        {
          submittedBy: "deleted",
          submitterDeleted: true,
          submittedByName: "Deleted User",
          submittedByEmail: "",
          submittedByPhone: "",
          updatedAt: nowIso,
        },
        env,
        true
      ).catch(() => {});
      await firestoreDeleteDoc(`groupOwnership/${g.id}`, env).catch(() => {});
    }

    // 2. Delete user favorites & notifications
    const favs = await firestoreRunQueryField("favorites", "userId", "EQUAL", uid, env, 100);
    for (const f of favs) {
      await firestoreDeleteDoc(`favorites/${f.id}`, env).catch(() => {});
    }
    const notifs = await firestoreRunQueryField("notifications", "userId", "EQUAL", uid, env, 100);
    for (const n of notifs) {
      await firestoreDeleteDoc(`notifications/${n.id}`, env).catch(() => {});
    }

    // 3. Mark accountUidRegistry & record deletedAccounts tombstone
    if (accountUid) {
      await firestoreSetDoc(
        `accountUidRegistry/${accountUid}`,
        {
          accountUid,
          firebaseUid: uid,
          status: "deleted",
          deletedAt: nowIso,
        },
        env,
        true
      ).catch(() => {});
    }

    await firestoreSetDoc(
      `deletedAccounts/${accountUid}`,
      {
        accountUid,
        status: "permanently_deleted",
        deletedAt: nowIso,
        deletedBy: uid,
        deletedByEmail: email,
        reason: "Self Direct Permanent Deletion",
        deletionType: "direct_user_delete",
        reRegistrationAllowed: true,
      },
      env,
      true
    ).catch(() => {});

    // 4. Clean up identity indexes server-side (all canonical + legacy variations)
    if (email) {
      await firestoreDeleteDoc(`emailIndex/${encodeURIComponent(email)}`, env).catch(() => {});
    }
    if (phone) {
      const phoneNorm = normalizeIndianMobileNumber(phone);
      const keys = phoneNorm.valid ? phoneNorm.variations : [phone];
      for (const k of Array.from(new Set([phone, ...keys]))) {
        await firestoreDeleteDoc(`mobileIndex/${encodeURIComponent(k)}`, env).catch(() => {});
      }
    }

    // 5. Delete user profile & pending registrations docs
    await firestoreDeleteDoc(`pendingRegistrations/${uid}`, env).catch(() => {});
    await firestoreDeleteDoc(`users/${uid}`, env).catch(() => {});

    // 6. Delete Firebase Auth user
    try {
      const accessToken = await getGoogleAccessToken(serviceAccount);
      await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ localId: uid }),
      });
    } catch (authErr: any) {
      console.warn("[Cloudflare Auth] Self-delete Auth cleanup notice:", authErr?.message);
    }

    // 7. Audit log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await firestoreSetDoc(
      `audit_logs/${auditId}`,
      {
        action: "USER_SELF_DELETED",
        targetUid: uid,
        actorUid: uid,
        details: { accountUid },
        createdAt: nowIso,
        timestamp: nowIso,
      },
      env,
      false
    ).catch(() => {});

    return jsonResponse({ success: true });
  } catch (err: any) {
    const msg = String(err?.message || "");
    const isTransient =
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Quota exceeded") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("DEADLINE_EXCEEDED") ||
      msg.includes("429") ||
      msg.includes("503");
    console.error("[Cloudflare Auth] Account deletion error:", msg || "unexpected");
    return errorResponse(
      isTransient
        ? "Account deletion service is temporarily busy. Please try again in a moment."
        : "Failed to delete account. Please try again.",
      isTransient ? 503 : 500
    );
  }
}
