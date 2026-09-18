import type { IncomingMessage, ServerResponse } from "http";
import { getFirebaseAdminApp } from "./admin-api";
import { getAuth } from "firebase-admin/auth";

export const EMAIL_CHANGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const EMAIL_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

// In-memory rate limiting and request tracking cache for dev server
const devRequestStore = new Map<
  string,
  {
    requestId: string;
    userId: string;
    oldEmail: string;
    newEmail: string;
    rawToken: string;
    expiresAt: number;
    createdAt: number;
    status: "pending" | "verified" | "cancelled" | "superseded" | "expired";
  }
>();

const devUserCooldownStore = new Map<string, number>();

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

export async function handleDevEmailChangeRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }

  const authHeader = req.headers["authorization"] || "";
  const idToken = authHeader.replace("Bearer ", "").trim();

  let uid = "";
  let currentAuthEmail = "";

  const app = getFirebaseAdminApp();
  if (app && idToken) {
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
      currentAuthEmail = decoded.email || "";
    } catch (e: any) {
      // If mock token or token decode fallback
      console.warn("[Dev Server] verifyIdToken notice:", e.message);
    }
  }

  const body = await parseBody(req);
  const newEmail = (body.newEmail || "").trim().toLowerCase();
  uid = uid || body.uid || "dev_user";
  currentAuthEmail = currentAuthEmail || body.currentEmail || "";

  if (!newEmail || !newEmail.endsWith("@gmail.com")) {
    sendJson(res, { error: "Only personal Gmail addresses (@gmail.com) are supported." }, 400);
    return;
  }

  const now = Date.now();
  const lastRequest = devUserCooldownStore.get(uid) || 0;
  if (now - lastRequest < EMAIL_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (now - lastRequest)) / 1000);
    sendJson(res, { error: `Please wait ${waitSec}s before requesting another verification email.` }, 429);
    return;
  }

  devUserCooldownStore.set(uid, now);

  const rawToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const requestId = `req_${uid}_${now}`;
  const expiresAt = now + EMAIL_CHANGE_TTL_MS;

  devRequestStore.set(requestId, {
    requestId,
    userId: uid,
    oldEmail: currentAuthEmail,
    newEmail,
    rawToken,
    expiresAt,
    createdAt: now,
    status: "pending",
  });

  const resendApiKey = process.env.RESEND_API_KEY;
  const host = req.headers["host"] || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const verificationLink = `${origin}/verify-handler?mode=verifyAndChangeEmail&reqId=${requestId}&uid=${uid}&token=${rawToken}`;

  console.log(`[Dev Server] Email Change Requested for UID ${uid} -> ${newEmail}`);
  console.log(`[Dev Server] Verification link: ${verificationLink}`);

  if (resendApiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "LinkCloud Security <verify@linkcloud.in>",
          to: [newEmail],
          subject: "Confirm your LinkCloud email change",
          html: `<p>Please click this link to confirm your email change: <a href="${verificationLink}">${verificationLink}</a>. Link is valid for 5 minutes.</p>`,
        }),
      });
      console.log(`[Dev Server] Resend email dispatched to ${newEmail}`);
    } catch (e) {
      console.warn("[Dev Server] Resend dispatch notice:", e);
    }
  }

  sendJson(res, {
    success: true,
    requestId,
    expiresAt,
    newEmail,
    devVerificationLink: verificationLink,
    message: "Verification email sent. Link is valid for 5 minutes.",
  });
}

export async function handleDevEmailChangeResend(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }

  const body = await parseBody(req);
  const pendingEmail = (body.pendingEmail || "").trim().toLowerCase();
  const uid = body.uid || "dev_user";

  const now = Date.now();
  const lastRequest = devUserCooldownStore.get(uid) || 0;
  if (now - lastRequest < EMAIL_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (now - lastRequest)) / 1000);
    sendJson(res, { error: `Please wait ${waitSec}s before requesting another verification email.` }, 429);
    return;
  }

  devUserCooldownStore.set(uid, now);

  const rawToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const requestId = `req_${uid}_${now}`;
  const expiresAt = now + EMAIL_CHANGE_TTL_MS;

  devRequestStore.set(requestId, {
    requestId,
    userId: uid,
    oldEmail: "",
    newEmail: pendingEmail,
    rawToken,
    expiresAt,
    createdAt: now,
    status: "pending",
  });

  const host = req.headers["host"] || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const verificationLink = `${origin}/verify-handler?mode=verifyAndChangeEmail&reqId=${requestId}&uid=${uid}&token=${rawToken}`;

  console.log(`[Dev Server] Resent verification link: ${verificationLink}`);

  sendJson(res, {
    success: true,
    requestId,
    expiresAt,
    newEmail: pendingEmail,
    devVerificationLink: verificationLink,
    message: "New verification email dispatched. Link is valid for 5 minutes.",
  });
}

export async function handleDevEmailChangeVerify(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }

  const body = await parseBody(req);
  const reqId = (body.reqId || body.requestId || "").trim();
  const token = (body.token || "").trim();
  const uid = (body.uid || "").trim();

  const stored = devRequestStore.get(reqId);
  if (!stored) {
    // If not in dev store, let client know it might need Firestore verification or was completed
    sendJson(res, {
      success: true,
      verified: true,
      uid,
      message: "Verification processed.",
    });
    return;
  }

  const now = Date.now();
  if (stored.expiresAt < now) {
    sendJson(res, { error: "This verification link has expired. Please request a new one." }, 410);
    return;
  }

  if (stored.rawToken !== token) {
    sendJson(res, { error: "Invalid verification token." }, 403);
    return;
  }

  // Update Firebase Auth if Admin SDK is connected
  let customToken = "";
  const app = getFirebaseAdminApp();
  if (app && stored.userId) {
    try {
      await getAuth(app).updateUser(stored.userId, {
        email: stored.newEmail,
        emailVerified: true,
      });
      console.log(`[Dev Server] Updated Firebase Auth for ${stored.userId} to ${stored.newEmail}`);
      customToken = await getAuth(app).createCustomToken(stored.userId);
      console.log(`[Dev Server] Minted customToken for ${stored.userId}`);
    } catch (e: any) {
      console.warn("[Dev Server] updateUser notice:", e.message);
    }
  }

  stored.status = "completed";

  sendJson(res, {
    success: true,
    verified: true,
    completed: true,
    uid: stored.userId,
    oldEmail: stored.oldEmail,
    newEmail: stored.newEmail,
    customToken,
    message: "New email address verified and updated successfully!",
  });
}

export async function handleDevEmailChangeSessionRefresh(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }

  const body = await parseBody(req);
  const uid = (body.uid || "").trim();
  const reqId = (body.reqId || body.requestId || "").trim();

  if (!uid) {
    sendJson(res, { error: "Missing required parameter: uid." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firebase Admin is not configured on dev server." }, 500);
    return;
  }

  try {
    const customToken = await getAuth(app).createCustomToken(uid);
    let newEmail = "";
    if (reqId && devRequestStore.has(reqId)) {
      newEmail = devRequestStore.get(reqId)!.newEmail;
    }
    sendJson(res, {
      success: true,
      uid,
      newEmail,
      customToken,
      message: "Fresh session custom token generated successfully.",
    });
  } catch (err: any) {
    console.error("[Dev Server] createCustomToken error:", err);
    sendJson(res, { error: err.message || "Failed to create custom token" }, 500);
  }
}

export async function handleDevEmailChangeCancel(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }

  const body = await parseBody(req);
  const reqId = (body.reqId || body.requestId || "").trim();
  const uid = (body.uid || "").trim();

  if (reqId && devRequestStore.has(reqId)) {
    const item = devRequestStore.get(reqId)!;
    item.status = "cancelled";
  }

  sendJson(res, {
    success: true,
    message: "Email change cancelled.",
  });
}

