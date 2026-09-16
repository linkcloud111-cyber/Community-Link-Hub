import {
  jsonResponse,
  errorResponse,
  type Env,
} from "./_common";
import { verifyFirebaseIdToken } from "./_firebase-admin";
import { firestoreGetDoc, firestoreSetDoc } from "./_firestore";

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

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid Authorization header", 401);
    }
    const idToken = authHeader.split("Bearer ")[1].trim();
    if (!idToken) {
      return errorResponse("Missing ID token in Authorization header", 401);
    }

    let decodedUser: { uid: string; email?: string };
    try {
      decodedUser = await verifyFirebaseIdToken(idToken, env);
    } catch (authErr: any) {
      return errorResponse(`Authentication failed: ${authErr.message}`, 401);
    }

    const uid = decodedUser.uid;
    const now = Date.now();

    // Check active request
    const activeDoc = await firestoreGetDoc(`users/${uid}/emailChanges/active`, env);
    if (activeDoc && activeDoc.requestId) {
      // If already verified, do not allow cancelling
      if (activeDoc.status === "VERIFIED" || activeDoc.status === "verified") {
        return errorResponse("Email change has already been verified and cannot be cancelled.", 400);
      }

      await firestoreSetDoc(
        `emailChangeRequests/${activeDoc.requestId}`,
        { status: "cancelled", updatedAt: now },
        env
      );
    }

    await firestoreSetDoc(
      `users/${uid}/emailChanges/active`,
      { status: "CANCELLED", updatedAt: now },
      env
    );

    return jsonResponse({
      success: true,
      message: "Email change request successfully cancelled.",
    });
  } catch (err: any) {
    console.error("[CANCEL EMAIL CHANGE ERROR]", err);
    return errorResponse(err.message || "Internal server error", 500);
  }
}
