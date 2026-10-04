import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type { AuthErrorContext } from "./auth-errors";

export type AuthEventOutcome = "success" | "failure";

export type AuthEventMethod =
  | "email_password"
  | "mobile_otp"
  | "mobile_password"
  | "google"
  | "email_verification"
  | "password_reset"
  | "password_change"
  | "email_change"
  | "registration"
  | "session";

export type AuthFailureType =
  | "none"
  | "invalid_credentials"
  | "invalid_otp"
  | "expired_otp"
  | "invalid_phone"
  | "invalid_email"
  | "unauthorized_role"
  | "account_inactive"
  | "unverified_email"
  | "rate_limited"
  | "network_error"
  | "popup_closed"
  | "action_code_invalid"
  | "action_code_expired"
  | "email_conflict"
  | "weak_password"
  | "validation_error"
  | "unknown_error";

export interface AuthEventLogRecord {
  id?: string;
  event: string;
  method: AuthEventMethod;
  context: AuthErrorContext;
  outcome: AuthEventOutcome;
  failureType: AuthFailureType;
  errorCode: string | null;
  errorMessage: string | null;
  uid: string | null;
  maskedIdentifier: string | null;
  portal: "user" | "webmaster" | "system";
  route: string;
  createdAt?: Timestamp | any;
  timestampIso: string;
}

const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*\S+/gi,
  /pass\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /idToken\s*[:=]\s*\S+/gi,
  /refreshToken\s*[:=]\s*\S+/gi,
  /customToken\s*[:=]\s*\S+/gi,
  /oobCode\s*[:=]\s*\S+/gi,
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  /\b\d{6}\b/g, // 6-digit OTP codes
];

/**
 * Scrubs any string to ensure passwords, tokens, action codes, or 6-digit OTPs are never logged.
 */
export function sanitizeAuthLogText(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  let sanitized = input.trim();
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized.slice(0, 300);
}

/**
 * Masks an email or phone identifier so full PII/credentials are never exposed in logs,
 * while retaining enough structure for security auditing.
 */
export function maskAuthIdentifier(identifier: string | null | undefined): string | null {
  if (!identifier || typeof identifier !== "string") return null;
  const clean = identifier.trim();
  if (!clean) return null;

  if (clean.includes("@")) {
    const [local, domain] = clean.toLowerCase().split("@");
    if (!local || !domain) return "***@***";
    if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
  }

  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `+91******${digits.slice(-4)}`;
  }

  return "***";
}

/**
 * Classifies an authentication error into a structured AuthFailureType category.
 */
export function classifyAuthFailureType(
  errorCode: string | null | undefined,
  errorMessage: string | null | undefined,
  method: AuthEventMethod
): AuthFailureType {
  const code = (errorCode || "").toLowerCase().trim();
  const msg = (errorMessage || "").toLowerCase().trim();

  if (code === "auth/invalid-verification-code" || msg.includes("invalid otp")) {
    return "invalid_otp";
  }
  if (
    code === "auth/code-expired" ||
    code === "auth/session-expired" ||
    code === "auth/invalid-verification-id" ||
    msg.includes("otp expired")
  ) {
    return "expired_otp";
  }
  if (
    code === "auth/invalid-phone-number" ||
    code === "auth/missing-phone-number" ||
    msg.includes("invalid mobile number")
  ) {
    return "invalid_phone";
  }
  if (
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    msg.includes("incorrect email or password") ||
    msg.includes("incorrect current password")
  ) {
    return method === "mobile_otp" ? "invalid_otp" : "invalid_credentials";
  }
  if (code === "auth/invalid-email" || msg.includes("valid gmail") || msg.includes("valid email")) {
    return "invalid_email";
  }
  if (code === "auth/too-many-requests" || msg.includes("too many") || msg.includes("locked")) {
    return "rate_limited";
  }
  if (code === "auth/network-request-failed" || msg.includes("network connection")) {
    return "network_error";
  }
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/popup-blocked" ||
    msg.includes("popup")
  ) {
    return "popup_closed";
  }
  if (code === "auth/expired-action-code" || msg.includes("link has expired") || msg.includes("link expired")) {
    return "action_code_expired";
  }
  if (code === "auth/invalid-action-code" || msg.includes("link is invalid")) {
    return "action_code_invalid";
  }
  if (code === "auth/email-already-in-use" || code === "auth/email-already-exists" || msg.includes("already registered")) {
    return "email_conflict";
  }
  if (code === "auth/weak-password" || msg.includes("password must")) {
    return "weak_password";
  }
  if (msg.includes("not authorized") || msg.includes("webmaster account")) {
    return "unauthorized_role";
  }
  if (
    code === "auth/user-disabled" ||
    msg.includes("suspended") ||
    msg.includes("banned") ||
    msg.includes("inactive") ||
    msg.includes("deleted")
  ) {
    return "account_inactive";
  }
  if (msg.includes("pending verification") || msg.includes("verify your email")) {
    return "unverified_email";
  }
  return "unknown_error";
}

/**
 * Extracts a normalized Firebase error code from an unknown error object.
 */
export function extractAuthErrorCode(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "object") {
    const errObj = error as Record<string, any>;
    if (typeof errObj.code === "string" && errObj.code.trim()) {
      return errObj.code.trim().toLowerCase();
    }
    if (typeof errObj.message === "string") {
      const match = errObj.message.match(/auth\/[a-z0-9-]+/i);
      if (match) return match[0].toLowerCase();
    }
  } else if (typeof error === "string") {
    const match = error.match(/auth\/[a-z0-9-]+/i);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

/**
 * Writes a sanitized, credential-free authentication event record to the dedicated
 * `auth_event_logs` Firestore collection. Non-blocking and fail-safe.
 */
export async function logAuthEvent(params: {
  event: string;
  method: AuthEventMethod;
  context?: AuthErrorContext;
  outcome: AuthEventOutcome;
  error?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  uid?: string | null;
  identifier?: string | null;
  portal?: "user" | "webmaster" | "system";
}): Promise<void> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return;

    const extractedCode = params.errorCode || extractAuthErrorCode(params.error);
    const rawMsg =
      params.errorMessage ||
      (params.error && typeof (params.error as any).message === "string"
        ? (params.error as any).message
        : typeof params.error === "string"
        ? params.error
        : null);

    const sanitizedMsg = params.outcome === "failure" ? sanitizeAuthLogText(rawMsg) : null;
    const failureType: AuthFailureType =
      params.outcome === "success"
        ? "none"
        : classifyAuthFailureType(extractedCode, sanitizedMsg, params.method);

    const route =
      typeof window !== "undefined" && window.location?.pathname
        ? window.location.pathname
        : "/";

    const portal =
      params.portal ||
      (route.startsWith("/webmaster") ? "webmaster" : "user");

    const record: Omit<AuthEventLogRecord, "id"> = {
      event: params.event.slice(0, 100),
      method: params.method,
      context: params.context || "general",
      outcome: params.outcome,
      failureType,
      errorCode: extractedCode ? extractedCode.slice(0, 100) : null,
      errorMessage: sanitizedMsg,
      uid: params.uid || auth?.currentUser?.uid || null,
      maskedIdentifier: maskAuthIdentifier(params.identifier),
      portal,
      route: route.slice(0, 120),
      createdAt: serverTimestamp(),
      timestampIso: new Date().toISOString(),
    };

    await addDoc(collection(db, "auth_event_logs"), record);
  } catch (logErr) {
    // Non-fatal: logging must never interrupt authentication flows
    console.warn("[AUTH LOGGER] Notice:", logErr);
  }
}

/**
 * Fetches recent authentication event logs for Webmaster forensic inspection.
 */
export async function getAuthEventLogs(
  limitCount = 50,
  outcomeFilter?: AuthEventOutcome | "all"
): Promise<AuthEventLogRecord[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const colRef = collection(db, "auth_event_logs");
    const q =
      outcomeFilter && outcomeFilter !== "all"
        ? query(
            colRef,
            where("outcome", "==", outcomeFilter),
            orderBy("createdAt", "desc"),
            limit(limitCount)
          )
        : query(colRef, orderBy("createdAt", "desc"), limit(limitCount));

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AuthEventLogRecord));
  } catch (err) {
    console.warn("[AUTH LOGGER] Failed to fetch auth_event_logs:", err);
    return [];
  }
}
