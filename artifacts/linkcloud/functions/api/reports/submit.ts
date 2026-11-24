import { validateReportPayload } from "../../../src/lib/group-validation";
import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import { getServiceAccount, verifyFirebaseIdToken } from "../email-change/_firebase-admin";
import {
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreIncrementField,
} from "../email-change/_firestore";

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

// Isolate-local sliding-window rate limiting maps for Cloudflare Worker runtime.
// Note: Limits apply per edge isolate instance; cross-PoP enforcement requires KV/Durable Objects.
const ipReportRateMap = new Map<string, { count: number; resetAt: number }>();
const groupCooldownMap = new Map<string, number>();

const REPORT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REPORTS_PER_IP = 10;
const DUPLICATE_GROUP_COOLDOWN_MS = 10 * 60 * 1000;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipReportRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipReportRateMap.set(ip, { count: 1, resetAt: now + REPORT_WINDOW_MS });
    if (ipReportRateMap.size > 2000) {
      for (const [k, v] of ipReportRateMap.entries()) {
        if (v.resetAt <= now) ipReportRateMap.delete(k);
      }
    }
    return true;
  }
  if (entry.count >= MAX_REPORTS_PER_IP) return false;
  entry.count++;
  return true;
}

function checkDuplicateCooldown(key: string): boolean {
  const now = Date.now();
  const expiresAt = groupCooldownMap.get(key);
  if (expiresAt && expiresAt > now) {
    return false;
  }
  groupCooldownMap.set(key, now + DUPLICATE_GROUP_COOLDOWN_MS);
  if (groupCooldownMap.size > 2000) {
    for (const [k, v] of groupCooldownMap.entries()) {
      if (v <= now) groupCooldownMap.delete(k);
    }
  }
  return true;
}

function generateReportId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `rep_${Date.now().toString(36)}_${hex}`;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "edge-unknown";

  if (!checkIpRateLimit(clientIp)) {
    return errorResponse("Too many reports submitted. Please try again later.", 429);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  if (!groupId || groupId.length > 128) {
    return errorResponse("Valid groupId is required.", 400);
  }

  // Verify optional Bearer ID Token cleanly (never trust client-supplied reportedBy UID)
  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  let authenticatedUid = "";
  let authenticatedName = "";

  if (idToken) {
    try {
      const decoded = await verifyFirebaseIdToken(idToken, env);
      authenticatedUid = decoded.uid;
      const userDoc = await firestoreGetDoc(`users/${authenticatedUid}`, env);
      authenticatedName = String(userDoc?.displayName || decoded.email || "Registered User").slice(0, 100);
    } catch {
      return errorResponse("Invalid or expired authentication token.", 401);
    }
  }

  const validation = validateReportPayload({
    isSignedIn: Boolean(authenticatedUid),
    reporterName: body.reportedByName,
    reason: body.reason,
    details: body.details,
  });

  if (!validation.valid) {
    const firstError =
      validation.errors.reporterName ||
      validation.errors.reason ||
      validation.errors.details ||
      "Please complete all required report fields.";
    return errorResponse(firstError, 400, { fieldErrors: validation.errors });
  }

  const serviceAccount = getServiceAccount(env);
  if (!serviceAccount) {
    return errorResponse("Reporting service is temporarily unavailable.", 503);
  }

  try {
    // Check reportSystemEnabled setting & verify target group exists
    const [siteSettings, groupDoc] = await Promise.all([
      firestoreGetDoc("settings/site", env),
      firestoreGetDoc(`groups/${groupId}`, env),
    ]);

    if (siteSettings && siteSettings.reportSystemEnabled === false) {
      return errorResponse("Abuse reporting is currently disabled by the webmaster.", 403);
    }

    if (!groupDoc) {
      return errorResponse("Target group was not found.", 404);
    }

    // Duplicate / repeated report cooldown per (reporter identity / IP + groupId)
    const cooldownKey = `${authenticatedUid || clientIp}:${groupId}`;
    if (!checkDuplicateCooldown(cooldownKey)) {
      return errorResponse(
        "You have already reported this group recently. Please wait before submitting again.",
        429
      );
    }

    const reportId = generateReportId();
    const nowIso = new Date().toISOString();

    await firestoreSetDoc(
      `reports/${reportId}`,
      {
        groupId,
        groupName: String(groupDoc.name || body.groupName || "Community Group").slice(0, 150),
        reportedBy: authenticatedUid,
        reportedByName: authenticatedUid ? authenticatedName : validation.cleanData.reporterName,
        reason: validation.cleanData.reason,
        details: validation.cleanData.details,
        status: "pending",
        createdAt: nowIso,
      },
      env,
      false
    );

    await firestoreIncrementField(`groups/${groupId}`, "reportCount", 1, env).catch(() => {});

    // Never expose reporter PII in public response
    return jsonResponse({
      success: true,
      id: reportId,
    });
  } catch (err: any) {
    console.error("[Cloudflare Reports] Submit report error:", err?.message || "unexpected");
    return errorResponse("Failed to submit report. Please try again.", 500);
  }
}
