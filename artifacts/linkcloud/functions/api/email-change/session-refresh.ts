import {
  jsonResponse,
  errorResponse,
  type Env,
} from "./_common";
import { adminCreateCustomToken, verifyFirebaseIdToken } from "./_firebase-admin";
import { firestoreGetDoc } from "./_firestore";

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
  try {
    const { request, env } = context;

    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return errorResponse("Authentication required: Missing Bearer token.", 401);
    }
    const idToken = authHeader.slice("Bearer ".length).trim();
    if (!idToken) {
      return errorResponse("Authentication required: Empty Bearer token.", 401);
    }

    let decodedUser: { uid: string; email?: string };
    try {
      decodedUser = await verifyFirebaseIdToken(idToken, env);
    } catch (authErr: any) {
      return errorResponse(`Authentication failed: ${authErr.message}`, 401);
    }

    const body: any = await request.json().catch(() => ({}));
    const uid = (body.uid || decodedUser.uid || "").trim();
    const reqId = (body.reqId || body.requestId || "").trim();

    if (!uid) {
      return errorResponse("Missing required parameter: uid.", 400);
    }
    if (decodedUser.uid !== uid) {
      return errorResponse("Forbidden: Authenticated user does not match requested uid.", 403);
    }

    let isCompleted = false;
    let newEmail = "";
    const now = Date.now();
    const MAX_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

    // 1. Check reqId if provided
    if (reqId) {
      const reqDoc = await firestoreGetDoc(`emailChangeRequests/${reqId}`, env);
      const st = String(reqDoc?.status || "").toLowerCase();
      const verifiedAtMs = typeof reqDoc?.verifiedAt === "number" ? reqDoc.verifiedAt : (reqDoc?.verifiedAt ? new Date(reqDoc.verifiedAt).getTime() : 0);
      if (
        reqDoc &&
        reqDoc.userId === uid &&
        (st === "completed" || st === "verified") &&
        (!verifiedAtMs || now - verifiedAtMs <= MAX_REFRESH_WINDOW_MS)
      ) {
        isCompleted = true;
        newEmail = reqDoc.newEmail || "";
      }
    }

    // 2. Check user's active record if not resolved yet
    if (!isCompleted) {
      const activeDoc = await firestoreGetDoc(`users/${uid}/emailChanges/active`, env);
      const st = String(activeDoc?.status || "").toLowerCase();
      const verifiedAtMs = typeof activeDoc?.verifiedAt === "number" ? activeDoc.verifiedAt : (activeDoc?.verifiedAt ? new Date(activeDoc.verifiedAt).getTime() : 0);
      if (
        activeDoc &&
        (st === "completed" || st === "verified") &&
        (!verifiedAtMs || now - verifiedAtMs <= MAX_REFRESH_WINDOW_MS)
      ) {
        isCompleted = true;
        newEmail = activeDoc.targetEmail || activeDoc.newEmail || "";
      }
    }

    if (!isCompleted) {
      return errorResponse("No recently completed email change request found for this account.", 404, {
        code: "not_completed",
      });
    }

    const customToken = await adminCreateCustomToken(env, uid);
    return jsonResponse({
      success: true,
      uid,
      newEmail,
      customToken,
      message: "Fresh session custom token generated successfully.",
    });
  } catch (err: any) {
    console.error("[SESSION REFRESH ERROR]", err);
    return errorResponse(err.message || "Failed to generate session refresh token.", 500);
  }
}
