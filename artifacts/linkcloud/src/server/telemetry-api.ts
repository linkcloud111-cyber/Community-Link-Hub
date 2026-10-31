import type { IncomingMessage, ServerResponse } from "http";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./admin-api";

// ─── Rate Limiting & Abuse Prevention ─────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const visitorIpLimiter = new Map<string, RateLimitBucket>();
const searchIpLimiter = new Map<string, RateLimitBucket>();

function checkRateLimit(
  map: Map<string, RateLimitBucket>,
  ip: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = map.get(ip);

  if (!bucket || now > bucket.resetAt) {
    map.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}

// Clean up stale buckets every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of visitorIpLimiter.entries()) {
    if (now > bucket.resetAt) visitorIpLimiter.delete(ip);
  }
  for (const [ip, bucket] of searchIpLimiter.entries()) {
    if (now > bucket.resetAt) searchIpLimiter.delete(ip);
  }
}, 10 * 60 * 1000).unref?.();

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // Cap body size to 16KB to prevent denial-of-service
      if (body.length > 16384) {
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

// ─── Telemetry Handlers ───────────────────────────────────────────────────────

/**
 * Server-authoritative visitor hit logging.
 * Rejects GET/PUT/DELETE.
 * Does NOT trust client dates or counts.
 * Uses atomic FieldValue.increment(1).
 */
export async function handleTelemetryVisitorHit(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    return sendJson(res, { ok: true }, 204);
  }

  if (req.method !== "POST") {
    return sendJson(res, { error: "Method Not Allowed" }, 405);
  }

  const clientIp = getClientIp(req);
  // Rate limit: Max 10 visitor hits per IP per 5 minutes to prevent abuse
  if (!checkRateLimit(visitorIpLimiter, clientIp, 10, 5 * 60 * 1000)) {
    return sendJson(res, { error: "Rate limit exceeded" }, 429);
  }

  try {
    const adminApp = getFirebaseAdminApp();
    if (!adminApp) {
      // Graceful degradation when admin credentials are unconfigured
      return sendJson(res, { success: true, mode: "unconfigured" });
    }

    const firestore = getFirestore(adminApp);
    // Force authoritative server-side date in UTC (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];

    const docRef = firestore.collection("visitor_stats").doc(today);
    await docRef.set(
      {
        date: today,
        count: FieldValue.increment(1),
        lastHitAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return sendJson(res, { success: true });
  } catch (err: any) {
    console.error("[Telemetry] Failed to log visitor hit:", err?.message || err);
    return sendJson(res, { error: "Failed to record telemetry" }, 500);
  }
}

/**
 * Server-authoritative search query logging.
 * Validates search keywords, regex, length, and applies rate limiting.
 * Uses atomic FieldValue.increment(1).
 */
export async function handleTelemetrySearchQuery(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    return sendJson(res, { ok: true }, 204);
  }

  if (req.method !== "POST") {
    return sendJson(res, { error: "Method Not Allowed" }, 405);
  }

  const clientIp = getClientIp(req);
  // Rate limit: Max 40 search queries per IP per minute
  if (!checkRateLimit(searchIpLimiter, clientIp, 40, 60 * 1000)) {
    return sendJson(res, { error: "Rate limit exceeded" }, 429);
  }

  try {
    const body = await parseBody(req);
    const rawKeyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";

    // Keyword validation: between 2 and 60 characters
    if (rawKeyword.length < 2 || rawKeyword.length > 60) {
      return sendJson(res, { error: "Invalid keyword length" }, 400);
    }

    // Strictly reject potential script tags, HTML brackets, quotes, or code injection
    if (/[<>{}[\]\\"'`;]/.test(rawKeyword)) {
      return sendJson(res, { error: "Keyword contains invalid characters" }, 400);
    }

    // Strip remaining unsafe characters, allow Unicode letters/marks (Hindi/Indic scripts), numbers, spaces, hyphens, underscores
    const cleanKeyword = rawKeyword.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N}\s\-_]/gu, "").trim().slice(0, 60);
    if (cleanKeyword.length < 2) {
      return sendJson(res, { error: "Keyword contains only invalid characters" }, 400);
    }

    const adminApp = getFirebaseAdminApp();
    if (!adminApp) {
      return sendJson(res, { success: true, mode: "unconfigured" });
    }

    const firestore = getFirestore(adminApp);
    const docRef = firestore.collection("search_logs").doc(cleanKeyword);

    const payload: Record<string, any> = {
      keyword: cleanKeyword,
      count: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body?.category === "string" && body.category.trim().length > 0) {
      payload.category = body.category.trim().slice(0, 50);
    }
    if (typeof body?.platform === "string" && body.platform.trim().length > 0) {
      payload.platform = body.platform.trim().slice(0, 50);
    }
    if (typeof body?.language === "string" && body.language.trim().length > 0) {
      payload.language = body.language.trim().slice(0, 50);
    }
    if (typeof body?.location === "string" && body.location.trim().length > 0) {
      payload.location = body.location.trim().slice(0, 50);
    }

    await docRef.set(payload, { merge: true });
    return sendJson(res, { success: true });
  } catch (err: any) {
    console.error("[Telemetry] Failed to log search query:", err?.message || err);
    return sendJson(res, { error: "Failed to record search telemetry" }, 500);
  }
}
