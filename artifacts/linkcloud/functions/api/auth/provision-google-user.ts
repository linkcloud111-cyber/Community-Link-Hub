import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import {
  getServiceAccount,
  getGoogleAccessToken,
  adminCreateCustomToken,
  verifyFirebaseIdToken,
} from "../email-change/_firebase-admin";
import { firestoreGetDoc, firestoreSetDoc } from "../email-change/_firestore";

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

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const { idToken } = body;
  if (!idToken) {
    return errorResponse("Missing required idToken", 400);
  }

  let decoded: any = {};
  try {
    decoded = await verifyFirebaseIdToken(idToken, env);
  } catch (err: any) {
    console.warn("[Cloudflare Auth] Google token verification failed:", err?.message);
    return errorResponse("Invalid or expired authentication token.", 401);
  }

  const googleEmail = (decoded.email || "").trim().toLowerCase();
  const googleName = decoded.displayName || decoded.name || "Google User";
  const googlePicture = decoded.photoURL || decoded.picture || "";

  if (!googleEmail) {
    return errorResponse("Google account does not have a verified email.", 400);
  }

  try {
    // Check existing user in emailIndex
    const existingIndex = await firestoreGetDoc(`emailIndex/${encodeURIComponent(googleEmail)}`, env);
    if (existingIndex && existingIndex.uid) {
      const existingUid = String(existingIndex.uid).trim();
      const [userDoc, wmDoc] = await Promise.all([
        firestoreGetDoc(`users/${encodeURIComponent(existingUid)}`, env),
        firestoreGetDoc(`webmaster/${encodeURIComponent(existingUid)}`, env),
      ]);
      const status = String(userDoc?.status || "active");
      if (
        status === "deleted" ||
        status === "suspended" ||
        status === "banned" ||
        userDoc?.suspended === true ||
        userDoc?.banned === true
      ) {
        return errorResponse("Your account has been suspended or disabled. Please contact support.", 403);
      }

      const isWebmaster = Boolean(
        existingUid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
          userDoc?.role === "webmaster" ||
          (wmDoc && wmDoc.active !== false)
      );
      if (!isWebmaster) {
        const siteSettings = await firestoreGetDoc("settings/site", env);
        if (siteSettings && siteSettings.googleLoginEnabled === false) {
          return errorResponse("Google sign-in is currently disabled by the webmaster.", 403, {
            code: "AUTH_METHOD_DISABLED",
          });
        }
      }

      const customToken = await adminCreateCustomToken(env, existingUid, {
        accountUid: userDoc?.accountUid || existingUid,
        role: isWebmaster ? "webmaster" : "user",
      });
      return jsonResponse({
        success: true,
        uid: existingUid,
        customToken,
        isNew: false,
      });
    }

    // Registration-First Rule: If Google identity is not registered in LinkCloud, reject
    return errorResponse(
      "Please register first. This Google account is not registered with LinkCloud.",
      403,
      { code: "ACCOUNT_NOT_REGISTERED" }
    );
  } catch (err: any) {
    const msg = String(err?.message || "");
    const isTransient =
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("DEADLINE_EXCEEDED") ||
      msg.includes("429") ||
      msg.includes("503");
    console.error("[Cloudflare Auth] Google provision failure:", msg || "unexpected");
    return errorResponse(
      isTransient
        ? "Authentication service is temporarily busy. Please try again in a moment."
        : "Authentication failed. Please try again.",
      isTransient ? 503 : 500
    );
  }
}
