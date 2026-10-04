/**
 * Centralized Firebase Authentication Error Handler
 *
 * Normalizes Firebase Auth error codes and exceptions into user-friendly,
 * context-aware standardized messages. Guaranteed to never return empty strings,
 * raw nulls, bare dots ('.'), technical stack artifacts, or cross-method errors.
 */

export type AuthErrorContext =
  | "email_password"
  | "mobile_otp"
  | "google"
  | "email_verification"
  | "password_reset"
  | "general";

export const FIREBASE_AUTH_ERROR_MAP: Record<string, string> = {
  // Credential & Login Failures (Email/Password Default)
  "auth/wrong-password": "Incorrect email or password. Please try again.",
  "auth/user-not-found": "Incorrect email or password. Please try again.",
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/invalid-login-credentials": "Incorrect email or password. Please try again.",

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
  "auth/invalid-verification-code": "Invalid OTP. Please try again.",
  "auth/invalid-verification-id": "Invalid verification session. Please request a new OTP code.",
  "auth/code-expired": "OTP expired. Please request a new one.",
  "auth/session-expired": "OTP expired. Please request a new one.",
  "auth/invalid-phone-number": "Invalid mobile number. Please check and try again.",
  "auth/missing-phone-number": "Invalid mobile number. Please check and try again.",
  "auth/quota-exceeded": "SMS quota exceeded for today. Please try again later or sign in with email.",
  "auth/captcha-check-failed": "reCAPTCHA verification failed. Please try again.",

  // Popup & OAuth Flows
  "auth/popup-closed-by-user": "Google sign-in popup was closed before completing.",
  "auth/popup-blocked": "Sign-in popup was blocked by your browser. Please allow popups for this site.",
  "auth/cancelled-popup-request": "Sign-in request was cancelled. Please try again.",
  "auth/unauthorized-domain": "Google Sign-In is not enabled for this domain. Please contact administrator or sign in with email.",
  "auth/operation-not-allowed": "This sign-in method is currently disabled.",

  // Action Code / Email Verification / Password Reset
  "auth/expired-action-code": "This link has expired. Please request a new one.",
  "auth/invalid-action-code": "This link is invalid or has already been used. Please request a new one.",

  // Network & Server
  "auth/invalid-api-key": "Invalid Firebase API key configuration. Please contact administrator.",
  "auth/api-key-not-valid": "Firebase API key is invalid or blocked. Please contact administrator.",
  "auth/app-deleted": "Firebase instance is currently unavailable. Please reload the page.",
  "auth/network-request-failed": "Network connection issue. Please check your internet connection and try again.",
  "auth/internal-error": "An internal error occurred. Please try again in a few moments.",
  "auth/timeout": "The request timed out. Please check your connection and try again.",

  // Account Linking
  "auth/credential-already-in-use": "This credential is already linked to another account.",
  "auth/account-exists-with-different-credential": "An account already exists with the same email address but different sign-in credentials.",
};

const CONTEXT_ERROR_OVERRIDES: Partial<Record<AuthErrorContext, Record<string, string>>> = {
  mobile_otp: {
    "auth/invalid-verification-code": "Invalid OTP. Please try again.",
    "auth/invalid-credential": "Invalid OTP. Please try again.",
    "auth/invalid-login-credentials": "Invalid OTP. Please try again.",
    "auth/invalid-verification-id": "OTP expired. Please request a new one.",
    "auth/code-expired": "OTP expired. Please request a new one.",
    "auth/session-expired": "OTP expired. Please request a new one.",
    "auth/invalid-phone-number": "Invalid mobile number. Please check and try again.",
    "auth/missing-phone-number": "Invalid mobile number. Please check and try again.",
    "auth/too-many-requests": "Too many OTP requests. Please wait a few minutes and try again.",
  },
  google: {
    "auth/invalid-credential": "Google authentication failed. Please try again.",
    "auth/user-not-found": "Please register first. This Google account is not registered with LinkCloud.",
    "auth/wrong-password": "An account already exists with this email using password login.",
    "auth/popup-closed-by-user": "Google sign-in popup was closed before completing.",
    "auth/popup-blocked": "Sign-in popup was blocked by your browser. Please allow popups for this site.",
    "auth/cancelled-popup-request": "Google sign-in was cancelled. Please try again.",
  },
  email_verification: {
    "auth/invalid-action-code": "This email verification link is invalid or has already been used.",
    "auth/expired-action-code": "This email verification link has expired. Please request a new verification email.",
    "auth/user-not-found": "Account not found for this verification link.",
    "auth/invalid-credential": "Verification session invalid. Please login and request a new verification link.",
    "auth/too-many-requests": "Too many verification email requests. Please wait a few minutes before trying again.",
  },
  password_reset: {
    "auth/invalid-email": "Please enter a valid registered email address.",
    "auth/user-not-found": "If this email is registered, a password reset link will be sent.",
    "auth/invalid-action-code": "This password reset link is invalid or has already been used. Please request a new link.",
    "auth/expired-action-code": "This password reset link has expired. Please request a new password reset email.",
    "auth/weak-password": "Password must be at least 8 characters long with uppercase, lowercase, number and symbol.",
    "auth/too-many-requests": "Too many password reset requests. Please wait a few minutes before trying again.",
  },
};

/**
 * Extracts and maps any error object, string, or code into a safe, polished message.
 */
export function getFriendlyAuthErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again.",
  context: AuthErrorContext = "general"
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

  const contextOverrides = CONTEXT_ERROR_OVERRIDES[context] || {};

  // 2. Direct code match from context overrides
  if (rawCode && contextOverrides[rawCode]) {
    return contextOverrides[rawCode];
  }

  // 3. Direct code match from global dictionary
  if (rawCode && FIREBASE_AUTH_ERROR_MAP[rawCode]) {
    return FIREBASE_AUTH_ERROR_MAP[rawCode];
  }

  const lowerMsg = rawMessage.toLowerCase();

  // 4. Context override substring search
  for (const [codeKey, friendlyMsg] of Object.entries(contextOverrides)) {
    const bareCode = codeKey.replace("auth/", "");
    if ((rawCode && rawCode.includes(bareCode)) || lowerMsg.includes(codeKey) || lowerMsg.includes(bareCode)) {
      return friendlyMsg;
    }
  }

  // 5. Normalized code substring search
  for (const [codeKey, friendlyMsg] of Object.entries(FIREBASE_AUTH_ERROR_MAP)) {
    const bareCode = codeKey.replace("auth/", "");
    if ((rawCode && rawCode.includes(bareCode)) || lowerMsg.includes(codeKey) || lowerMsg.includes(bareCode)) {
      if (
        context === "mobile_otp" &&
        friendlyMsg === "Incorrect email or password. Please try again."
      ) {
        return "Invalid OTP. Please try again.";
      }
      if (
        context === "google" &&
        friendlyMsg === "Incorrect email or password. Please try again."
      ) {
        return "Google authentication failed. Please try again.";
      }
      return friendlyMsg;
    }
  }

  // 6. Session expired heuristics
  if (
    lowerMsg.includes("session has expired") ||
    lowerMsg.includes("token is expired") ||
    lowerMsg.includes("token-expired") ||
    rawCode.includes("token-expired")
  ) {
    return context === "mobile_otp"
      ? "OTP expired. Please request a new one."
      : "Your session has expired. Please login again.";
  }

  // 7. Clean up any Firebase prefix e.g. "Firebase: Error (auth/invalid-credential)."
  const cleaned = rawMessage
    .replace(/^Firebase:\s*(Error\s*\([^)]+\):?\s*)?/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  // 8. Strict validation: Reject single dot '.', 'null', 'undefined', '[object Object]', or extremely short junk
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

  if (
    context === "mobile_otp" &&
    cleaned.toLowerCase().includes("incorrect email")
  ) {
    return "Invalid OTP. Please try again.";
  }

  return cleaned;
}

/**
 * Backward-compatible alias for existing code calling formatAuthError
 */
export function formatAuthError(
  error: unknown,
  fallback?: string,
  context: AuthErrorContext = "general"
): string {
  return getFriendlyAuthErrorMessage(error, fallback, context);
}
