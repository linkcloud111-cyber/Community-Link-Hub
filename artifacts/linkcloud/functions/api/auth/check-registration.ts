/**
 * LinkCloud - Registration Check Endpoint (Cloudflare Pages Functions)
 * 
 * Verifies whether a given Gmail address is registered and verified in LinkCloud.
 * Returns only boolean flags (registered, verified) to preserve user privacy
 * and prevent enumeration/PII leakage.
 */

import {
  errorResponse,
  type Env,
} from "../email-change/_common";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // max 20 email checks per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || record.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    // Cleanup stale entries
    if (rateLimitMap.size > 2000) {
      for (const [key, val] of rateLimitMap.entries()) {
        if (val.resetAt <= now) rateLimitMap.delete(key);
      }
    }
    return false;
  }
  record.count++;
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

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

  // Rate limiting to prevent automated Gmail account enumeration
  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "direct";

  if (isRateLimited(clientIp)) {
    return errorResponse("Too many requests. Please try again later.", 429);
  }

  // Unauthenticated account-existence lookup is permanently disabled to prevent
  // Gmail enumeration via response body, status, or Firestore timing side-channels.
  // Legitimate sign-in, registration, and password-reset flows operate directly via Firebase Auth.
  return errorResponse(
    "Account lookup is disabled to protect user privacy. Please sign in or reset your password directly.",
    403
  );
}
