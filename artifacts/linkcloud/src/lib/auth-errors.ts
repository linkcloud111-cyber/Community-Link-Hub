/**
 * Centralized Firebase Authentication Error Handler
 *
 * Normalizes Firebase Auth error codes and exceptions into user-friendly,
 * standardized messages. Guaranteed to never return empty strings, raw nulls,
 * bare dots ('.'), or technical stack artifacts.
 */

export const FIREBASE_AUTH_ERROR_MAP: Record<string, string> = {
  // Credential & Login Failures
  "auth/wrong-password": "Incorrect email address or password. Please try again.",
  "auth/user-not-found": "Incorrect email address or password. Please try again.",
  "auth/invalid-credential": "Incorrect email address or password. Please try again.",
  "auth/invalid-login-credentials": "Incorrect email address or password. Please try again.",

  // Email Validation & Collision
  "auth/invalid-email": "Please enter a valid Gmail address.",
  "auth/email-already-in-use": "This email address is already registered.",
  "auth/email-already-exists": "This email address is already registered.",

  // Password Strength & Policy
  "auth/weak-password": "Password must be at least 8 characters long with uppercase, lowercase, number and symbol.",

  // Account State & Lockout
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/too-many-requests": "Too many failed attempts. Access temporarily disabled. Please try again later or reset your password.",

  // Session & Security
  "auth/multi-factor-auth-required": "Multi-factor authentication required. Please verify via your registered mobile number.",
  "auth/requires-recent-login": "Please sign in again to complete this sensitive action.",
  "auth/user-token-expired": "Your session has expired. Please login again.",
  "auth/id-token-expired": "Your session has expired. Please login again.",
  "auth/id-token-revoked": "Your session was revoked. Please login again.",

  // Mobile / Phone Auth & OTP
  "auth/invalid-verification-code": "Invalid OTP code. Please check and try again.",
  "auth/invalid-verification-id": "Invalid verification session. Please request a new OTP code.",
  "auth/code-expired": "The verification code has expired. Please request a new OTP code.",
  "auth/invalid-phone-number": "Please enter a valid 10-digit Indian mobile number.",
  "auth/missing-phone-number": "Mobile number is required.",
  "auth/quota-exceeded": "SMS quota exceeded for today. Please try again later or sign in with email.",
  "auth/captcha-check-failed": "reCAPTCHA verification failed. Please try again.",

  // Popup & OAuth Flows
  "auth/popup-closed-by-user": "Google sign-in popup was closed before completing.",
  "auth/popup-blocked": "Sign-in popup was blocked by your browser. Please allow popups for this site.",
  "auth/cancelled-popup-request": "Sign-in request was cancelled. Please try again.",
  "auth/unauthorized-domain": "Google Sign-In is not enabled for this domain. Please contact administrator or sign in with email.",
  "auth/operation-not-allowed": "This sign-in method is currently disabled.",

  // Network & Server
  "auth/network-request-failed": "Network connection issue. Please check your internet connection and try again.",
  "auth/internal-error": "An internal error occurred. Please try again in a few moments.",
  "auth/timeout": "The request timed out. Please check your connection and try again.",

  // Account Linking
  "auth/credential-already-in-use": "This credential is already linked to another account.",
  "auth/account-exists-with-different-credential": "An account already exists with the same email address but different sign-in credentials.",
};

/**
 * Extracts and maps any error object, string, or code into a safe, polished message.
 */
export function getFriendlyAuthErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again."
): string {
  if (error == null) {
    return fallback;
  }

  // 1. If error is an Error instance or object with code/message
  const errObj = typeof error === "object" ? (error as Record<string, unknown>) : null;
  const rawCode = typeof errObj?.code === "string" ? errObj.code.toLowerCase().trim() : "";
  const rawMessage = typeof errObj?.message === "string"
    ? errObj.message
    : (typeof error === "string" ? error : "");

  // 2. Direct code match from dictionary
  if (rawCode && FIREBASE_AUTH_ERROR_MAP[rawCode]) {
    return FIREBASE_AUTH_ERROR_MAP[rawCode];
  }

  // 3. Normalized code substring search
  const lowerMsg = rawMessage.toLowerCase();
  for (const [codeKey, friendlyMsg] of Object.entries(FIREBASE_AUTH_ERROR_MAP)) {
    const bareCode = codeKey.replace("auth/", "");
    if ((rawCode && rawCode.includes(bareCode)) || lowerMsg.includes(codeKey) || lowerMsg.includes(bareCode)) {
      return friendlyMsg;
    }
  }

  // 4. Session expired heuristics
  if (
    lowerMsg.includes("session has expired") ||
    lowerMsg.includes("token is expired") ||
    lowerMsg.includes("token-expired") ||
    rawCode.includes("token-expired")
  ) {
    return "Your session has expired. Please login again.";
  }

  // 5. Clean up any Firebase prefix e.g. "Firebase: Error (auth/invalid-credential)."
  const cleaned = rawMessage
    .replace(/^Firebase:\s*(Error\s*\([^)]+\):?\s*)?/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  // 6. Strict validation: Reject single dot '.', 'null', 'undefined', '[object Object]', or extremely short junk
  if (
    !cleaned ||
    cleaned === "." ||
    cleaned === ".." ||
    cleaned.toLowerCase() === "null" ||
    cleaned.toLowerCase() === "undefined" ||
    cleaned === "[object Object]" ||
    cleaned.length <= 2 ||
    cleaned.startsWith("auth/") ||
    cleaned.startsWith("Firebase")
  ) {
    return fallback;
  }

  // Remove any trailing period if the message was an isolated fragment
  return cleaned;
}

/**
 * Backward-compatible alias for existing code calling formatAuthError
 */
export function formatAuthError(error: unknown, fallback?: string): string {
  return getFriendlyAuthErrorMessage(error, fallback);
}
