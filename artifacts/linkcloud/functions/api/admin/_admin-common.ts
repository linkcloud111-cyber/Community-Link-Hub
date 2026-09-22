import { type Env, errorResponse } from "../email-change/_common";
import { verifyFirebaseIdToken } from "../email-change/_firebase-admin";
import { firestoreGetDoc } from "../email-change/_firestore";

export interface WebmasterAuthResult {
  valid: boolean;
  uid?: string;
  email?: string;
  response?: Response;
}

export async function requireWebmasterAuth(
  request: Request,
  env: Env
): Promise<WebmasterAuthResult> {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      response: errorResponse("Authentication required: Missing Bearer token.", 401),
    };
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) {
    return {
      valid: false,
      response: errorResponse("Authentication required: Empty Bearer token.", 401),
    };
  }

  try {
    const verified = await verifyFirebaseIdToken(idToken, env);
    const uid = verified.uid;
    const email = verified.email || "";

    // 1. Check /webmaster/{uid}
    const webmasterDoc = await firestoreGetDoc(`webmaster/${uid}`, env);
    if (webmasterDoc) {
      const isActive = webmasterDoc.active !== false && (webmasterDoc.role === "webmaster" || !webmasterDoc.role);
      if (isActive) {
        return { valid: true, uid, email };
      }
    }

    // 2. Check /users/{uid}
    const userDoc = await firestoreGetDoc(`users/${uid}`, env);
    if (userDoc && userDoc.role === "webmaster" && userDoc.status === "active") {
      return { valid: true, uid, email };
    }

    return {
      valid: false,
      response: errorResponse("Forbidden: Webmaster authority required.", 403),
    };
  } catch (err: any) {
    return {
      valid: false,
      response: errorResponse(err?.message || "Invalid or expired token.", 401),
    };
  }
}
