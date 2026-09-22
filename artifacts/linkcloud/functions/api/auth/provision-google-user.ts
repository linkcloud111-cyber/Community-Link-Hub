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
    return errorResponse(err?.message || "Failed to verify ID token", 401);
  }

  const googleEmail = (decoded.email || "").trim().toLowerCase();
  const googleName = decoded.displayName || decoded.name || "Google User";
  const googlePicture = decoded.photoURL || decoded.picture || "";

  if (!googleEmail) {
    return errorResponse("Google account does not have a verified email.", 400);
  }

  // Check existing user in emailIndex
  const existingIndex = await firestoreGetDoc(`emailIndex/${googleEmail}`, env);
  if (existingIndex && existingIndex.uid) {
    const customToken = await adminCreateCustomToken(env, existingIndex.uid);
    return jsonResponse({
      success: true,
      uid: existingIndex.uid,
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
}
