import appletConfig from "../../../firebase-applet-config.json";
import { normalizeIndianMobileNumber } from "../../../src/lib/group-validation";
import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import {
  getServiceAccount,
  getGoogleAccessToken,
  adminCreateCustomToken,
} from "../email-change/_firebase-admin";
import { firestoreGetDoc, firestoreRunQueryField } from "../email-change/_firestore";

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

// Isolate-local sliding-window rate limiting map for Cloudflare Pages worker instances.
// NOTE: This map is local to the executing Cloudflare Worker isolate, NOT globally
// distributed across all edge PoPs. Global cross-PoP throttling requires Cloudflare KV,
// Durable Objects, or WAF Rate Limiting rules.
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const phoneIpRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const IP_WINDOW_MS = 60 * 1000;
const IP_MAX_ATTEMPTS = 25;
const PHONE_WINDOW_MS = 5 * 60 * 1000;
const PHONE_MAX_ATTEMPTS = 10;

function isRateLimited(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || entry.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    if (map.size > 2000) {
      for (const [k, v] of map.entries()) {
        if (v.resetAt <= now) map.delete(k);
      }
    }
    return false;
  }
  entry.count++;
  return entry.count > maxAttempts;
}

const GENERIC_AUTH_FAILURE_MSG = "Invalid mobile number or password.";

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

  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "edge-unknown";

  if (isRateLimited(ipRateLimitMap, clientIp, IP_MAX_ATTEMPTS, IP_WINDOW_MS)) {
    return errorResponse("Too many login attempts. Please wait a minute and try again.", 429);
  }

  const rawMobile = typeof body.mobile === "string" ? body.mobile : typeof body.phone === "string" ? body.phone : "";
  const password = typeof body.password === "string" ? body.password : "";
  const portal = body.portal === "webmaster" ? "webmaster" : "user";

  const norm = normalizeIndianMobileNumber(rawMobile);
  if (!norm.valid) {
    return errorResponse("Invalid mobile number. Please check and try again.", 400);
  }
  if (!password) {
    return errorResponse("Please enter your password.", 400);
  }

  const phoneRateKey = `${clientIp}:${norm.canonical}`;
  if (isRateLimited(phoneIpRateLimitMap, phoneRateKey, PHONE_MAX_ATTEMPTS, PHONE_WINDOW_MS)) {
    return errorResponse(
      "Too many failed attempts for this mobile number. Please try again in a few minutes.",
      429
    );
  }

  const serviceAccount = getServiceAccount(env);
  if (!serviceAccount) {
    return errorResponse("Authentication service is temporarily unavailable.", 503);
  }

  const webApiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || appletConfig.apiKey;
  if (!webApiKey) {
    return errorResponse("Authentication service is temporarily unavailable.", 503);
  }

  try {
    // 1. Server-side resolve UID via mobileIndex (+91 canonical + legacy spaced/10-digit formats)
    let resolvedUid = "";
    for (const variation of norm.variations) {
      const idxDoc = await firestoreGetDoc(`mobileIndex/${encodeURIComponent(variation)}`, env);
      if (idxDoc && idxDoc.uid && idxDoc.status !== "deleted") {
        resolvedUid = String(idxDoc.uid).trim();
        break;
      }
    }

    // Fallback for legacy users without mobileIndex entries (server-side query on /users)
    if (!resolvedUid) {
      const matchedUsers = await firestoreRunQueryField("users", "phone", "IN", norm.variations, env, 3);
      const activeMatch = matchedUsers.find((u) => u && u.status !== "deleted");
      if (activeMatch) {
        resolvedUid = activeMatch.uid || activeMatch.id;
      }
    }

    if (!resolvedUid) {
      return errorResponse(GENERIC_AUTH_FAILURE_MSG, 401);
    }

    // 2. Fetch authoritative user profile & Firebase Auth email for password verification
    const userDoc = await firestoreGetDoc(`users/${resolvedUid}`, env);
    let authEmail = typeof userDoc?.email === "string" ? userDoc.email.trim().toLowerCase() : "";

    const accessToken = await getGoogleAccessToken(serviceAccount);
    const lookupRes = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localId: [resolvedUid] }),
    });

    let authRecord: any = null;
    if (lookupRes.ok) {
      const lookupData: any = await lookupRes.json();
      authRecord = lookupData?.users?.[0] || null;
      if (authRecord?.email) {
        authEmail = String(authRecord.email).trim().toLowerCase();
      }
    }

    if (!authEmail) {
      // Do not expose that the phone belongs to an OTP-only account without password
      return errorResponse(GENERIC_AUTH_FAILURE_MSG, 401);
    }

    // 3. Verify password directly against Firebase Authentication Identity Toolkit
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password,
          returnSecureToken: false,
        }),
      }
    );

    if (!signInRes.ok) {
      const errData: any = await signInRes.json().catch(() => ({}));
      const errMsg = String(errData?.error?.message || "");
      if (errMsg.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
        return errorResponse("Too many login attempts. Please try again later.", 429);
      }
      // Identical generic 401 for wrong password, invalid login credentials, or disabled auth user
      return errorResponse(GENERIC_AUTH_FAILURE_MSG, 401);
    }

    // 4. Enforce account status after credentials have been verified
    const status = String(userDoc?.status || "active");
    if (status === "deleted" || authRecord?.disabled === true) {
      return errorResponse("This account has been suspended or disabled. Please contact support.", 403);
    }
    if (status === "suspended" || status === "banned" || userDoc?.suspended === true || userDoc?.banned === true) {
      return errorResponse("Your account has been suspended or banned. Please contact support.", 403);
    }

    // 5. Enforce Webmaster vs Regular User portal isolation using server-verified role
    const webmasterDoc = await firestoreGetDoc(`webmaster/${resolvedUid}`, env);
    const isWebmaster = Boolean(
      resolvedUid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
        userDoc?.role === "webmaster" ||
        (webmasterDoc && webmasterDoc.active !== false)
    );

    if (portal === "webmaster" && !isWebmaster) {
      return errorResponse("This account is not authorized to access the Webmaster Portal.", 403);
    }
    if (portal === "user" && isWebmaster) {
      return errorResponse("This is a Webmaster account. Please sign in from the Webmaster Login page.", 403);
    }

    // 6. Reset phone-specific limiter on successful authentication & issue Custom Token
    phoneIpRateLimitMap.delete(phoneRateKey);

    const customToken = await adminCreateCustomToken(env, resolvedUid, {
      accountUid: userDoc?.accountUid || resolvedUid,
      role: isWebmaster ? "webmaster" : "user",
    });

    // Privacy invariant: NEVER expose email, uid, accountUid, or phone in response
    return jsonResponse({
      success: true,
      customToken,
    });
  } catch (err: any) {
    const msg = String(err?.message || "");
    const isTransient =
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("DEADLINE_EXCEEDED") ||
      msg.includes("429") ||
      msg.includes("503");
    console.error("[Cloudflare Auth] Mobile password login failure:", msg || "unexpected");
    return errorResponse(
      isTransient
        ? "Authentication service is temporarily busy. Please try again in a moment."
        : "Unable to process login request. Please try again.",
      isTransient ? 503 : 500
    );
  }
}
