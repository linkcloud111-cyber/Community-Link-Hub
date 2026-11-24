import { type Env, errorResponse } from "../email-change/_common";
import { verifyFirebaseIdToken } from "../email-change/_firebase-admin";
import { firestoreGetDoc } from "../email-change/_firestore";

export interface WebmasterAuthResult {
  valid: boolean;
  uid?: string;
  email?: string;
  response?: Response;
}

export function isFirestoreQuotaError(err: any): boolean {
  const code = Number(err?.code);
  const msg = String(err?.message || err || "");
  return (
    code === 8 ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("429")
  );
}

export function isFirestoreTransientError(err: any): boolean {
  const code = Number(err?.code);
  const msg = String(err?.message || err || "");
  return (
    isFirestoreQuotaError(err) ||
    code === 14 ||
    code === 4 ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("DEADLINE_EXHAUSTED") ||
    msg.includes("DEADLINE_EXCEEDED")
  );
}

export function handleAdminFirestoreError(err: any, fallbackMessage: string): Response {
  if (isFirestoreQuotaError(err)) {
    return errorResponse(
      "Firestore daily quota exceeded. Daily quota resets tomorrow; please try again later or check your Firebase Spark/Blaze plan.",
      503
    );
  }
  if (isFirestoreTransientError(err)) {
    return errorResponse(
      "Database service is temporarily unavailable. Please try again shortly.",
      503
    );
  }
  return errorResponse(err?.message || fallbackMessage, 500);
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

  let uid: string;
  let email = "";
  try {
    const verified = await verifyFirebaseIdToken(idToken, env);
    uid = verified.uid;
    email = verified.email || "";
  } catch (err: any) {
    const msg = String(err?.message || err || "");
    console.warn("[Admin Auth] Token verification failed:", msg);
    if (isFirestoreQuotaError(err) || isFirestoreTransientError(err)) {
      return {
        valid: false,
        response: handleAdminFirestoreError(
          err,
          "Authentication service temporarily unavailable."
        ),
      };
    }
    return {
      valid: false,
      response: errorResponse("Invalid or expired authentication token.", 401),
    };
  }

  try {
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
    console.warn("[Admin Auth] Webmaster role lookup failed:", err?.message || err);
    return {
      valid: false,
      response: handleAdminFirestoreError(
        err,
        "Database service temporarily unavailable while verifying Webmaster permissions."
      ),
    };
  }
}
