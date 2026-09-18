import {
  jsonResponse,
  errorResponse,
  type Env,
} from "./_common";
import { adminCreateCustomToken } from "./_firebase-admin";
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
    const body: any = await request.json().catch(() => ({}));
    const uid = (body.uid || "").trim();
    const reqId = (body.reqId || body.requestId || "").trim();

    if (!uid) {
      return errorResponse("Missing required parameter: uid.", 400);
    }

    let isCompleted = false;
    let newEmail = "";

    // 1. Check reqId if provided
    if (reqId) {
      const reqDoc = await firestoreGetDoc(`emailChangeRequests/${reqId}`, env);
      if (reqDoc && reqDoc.userId === uid && reqDoc.status === "completed") {
        isCompleted = true;
        newEmail = reqDoc.newEmail || "";
      }
    }

    // 2. Check user's active record if not resolved yet
    if (!isCompleted) {
      const activeDoc = await firestoreGetDoc(`users/${uid}/emailChanges/active`, env);
      if (activeDoc && (activeDoc.status === "COMPLETED" || activeDoc.status === "completed")) {
        isCompleted = true;
        newEmail = activeDoc.targetEmail || activeDoc.newEmail || "";
      }
    }

    // 3. Check user profile if still not resolved
    if (!isCompleted) {
      const userProfile = await firestoreGetDoc(`users/${uid}`, env);
      if (userProfile && !userProfile.pendingEmail && !userProfile.activeEmailChangeRequestId) {
        // User profile has completed email change
        isCompleted = true;
        newEmail = userProfile.email || "";
      }
    }

    if (!isCompleted) {
      return errorResponse("No completed email change request found for this account.", 404, {
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
