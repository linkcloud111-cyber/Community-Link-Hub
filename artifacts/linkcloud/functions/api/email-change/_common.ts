export interface Env {
  RESEND_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  APP_URL?: string;
  VITE_APP_URL?: string;
}

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function errorResponse(error: string, status = 400, details?: any): Response {
  return jsonResponse({ success: false, error, ...(details ? { details } : {}) }, status);
}

export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getServiceAccount(env: Env): any {
  if (!env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return null;
  }
  try {
    return typeof env.FIREBASE_SERVICE_ACCOUNT_KEY === "string"
      ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : env.FIREBASE_SERVICE_ACCOUNT_KEY;
  } catch (err) {
    console.error("[SERVICE ACCOUNT] Failed to parse JSON:", err);
    return null;
  }
}
