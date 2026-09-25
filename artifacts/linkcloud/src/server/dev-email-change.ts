import type { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import { getFirebaseAdminApp } from "./admin-api.ts";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const EMAIL_CHANGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const EMAIL_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

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

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
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
  if (!authHeader.startsWith("Bearer ")) {
    sendJson(res, { error: "Authentication required: Missing Bearer token." }, 401);
    return;
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) {
    sendJson(res, { error: "Authentication required: Empty Bearer token." }, 401);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }

  let uid = "";
  let currentAuthEmail = "";
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    uid = decoded.uid;
    currentAuthEmail = decoded.email || "";
  } catch (e: any) {
    sendJson(res, { error: `Authentication failed: ${e.message}` }, 401);
    return;
  }

  const body = await parseBody(req);
  const newEmail = (body.newEmail || "").trim().toLowerCase();
  currentAuthEmail = currentAuthEmail || (body.currentEmail || "").trim().toLowerCase();

  if (!newEmail || !newEmail.endsWith("@gmail.com")) {
    sendJson(res, { error: "Only personal Gmail addresses (@gmail.com) are supported." }, 400);
    return;
  }

  if (currentAuthEmail && newEmail === currentAuthEmail) {
    sendJson(res, { error: "New email must be different from your current email." }, 400);
    return;
  }

  const firestore = app ? getFirestore(app) : null;
  const now = Date.now();

  // Check email uniqueness in emailIndex
  if (firestore) {
    try {
      const existingIndexDoc = await firestore.collection("emailIndex").doc(newEmail).get();
      if (existingIndexDoc.exists && existingIndexDoc.data()?.uid && existingIndexDoc.data()?.uid !== uid) {
        sendJson(res, { error: "This Gmail address is already registered to another account." }, 409);
        return;
      }
    } catch (idxErr) {
      console.warn("[Dev Server] emailIndex check note:", idxErr);
    }
  }

  // Check cooldown from Firestore
  if (firestore) {
    try {
      const recentReqs = await firestore
        .collection("emailChangeRequests")
        .where("userId", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (!recentReqs.empty) {
        const lastCreated = recentReqs.docs[0].data().createdAtMs || 0;
        if (now - lastCreated < EMAIL_RESEND_COOLDOWN_MS) {
          const waitSec = Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (now - lastCreated)) / 1000);
          res.setHeader("Retry-After", String(waitSec));
          sendJson(
            res,
            {
              success: false,
              error: `Please wait ${waitSec}s before requesting another verification email.`,
              retryAfter: waitSec,
            },
            429
          );
          return;
        }
      }
    } catch (cdErr) {
      console.warn("[Dev Server] Cooldown check note:", cdErr);
    }
  }

  // Generate secure token and hash it (raw token is never stored in DB)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const requestId = `req_${uid}_${now}`;
  const expiresAt = now + EMAIL_CHANGE_TTL_MS;

  if (firestore) {
    try {
      // Invalidate any existing pending requests for this user
      const existingPending = await firestore
        .collection("emailChangeRequests")
        .where("userId", "==", uid)
        .where("status", "==", "pending")
        .get();

      const batch = firestore.batch();
      existingPending.forEach((doc) => {
        batch.update(doc.ref, { status: "superseded", supersededAt: new Date().toISOString() });
      });

      // Save new request with hashed token
      const newReqRef = firestore.collection("emailChangeRequests").doc(requestId);
      batch.set(newReqRef, {
        requestId,
        userId: uid,
        oldEmail: currentAuthEmail,
        newEmail,
        tokenHash,
        expiresAt,
        expiresAtIso: new Date(expiresAt).toISOString(),
        createdAt: new Date().toISOString(),
        createdAtMs: now,
        status: "pending",
      });

      await batch.commit();
    } catch (saveErr) {
      console.error("[Dev Server] Failed to save emailChangeRequest to Firestore:", saveErr);
    }
  }

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
    nextAllowedAt: now + EMAIL_RESEND_COOLDOWN_MS,
    devVerificationLink: verificationLink,
    message: "Verification email sent. Link is valid for 5 minutes.",
  });
}

export async function handleDevEmailChangeResend(
  req: IncomingMessage,
  res: ServerResponse
) {
  // Resend uses identical logic with cooldown check and newly minted token
  return handleDevEmailChangeRequest(req, res);
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
  const rawToken = (body.token || body.rawToken || "").trim();
  const uid = (body.uid || "").trim();

  const app = getFirebaseAdminApp();
  const firestore = app ? getFirestore(app) : null;
  const now = Date.now();

  if (!firestore) {
    sendJson(res, { error: "Database service unavailable." }, 500);
    return;
  }

  try {
    const reqDoc = await firestore.collection("emailChangeRequests").doc(reqId).get();
    if (!reqDoc.exists) {
      sendJson(res, { error: "Invalid or expired verification request." }, 404);
      return;
    }

    const reqData = reqDoc.data()!;
    if (reqData.status !== "pending") {
      if (reqData.status === "verified") {
        sendJson(res, {
          success: true,
          verified: true,
          completed: true,
          uid: reqData.userId,
          newEmail: reqData.newEmail,
          message: "Email change already completed.",
        });
        return;
      }
      sendJson(res, { error: `This verification link is no longer valid (${reqData.status}).` }, 400);
      return;
    }

    if (reqData.expiresAt < now) {
      await reqDoc.ref.update({ status: "expired" });
      sendJson(res, { error: "This verification link has expired. Please request a new one." }, 410);
      return;
    }

    // Verify token hash
    const expectedHash = hashToken(rawToken);
    if (reqData.tokenHash !== expectedHash) {
      sendJson(res, { error: "Invalid verification token." }, 403);
      return;
    }

    const targetUid = reqData.userId;
    const oldEmail = reqData.oldEmail || "";
    const newEmail = reqData.newEmail;

    // 1. Update Firebase Auth user
    let customToken = "";
    try {
      const auth = getAuth(app);
      await auth.updateUser(targetUid, {
        email: newEmail,
        emailVerified: true,
      });
      customToken = await auth.createCustomToken(targetUid);
    } catch (authErr: any) {
      console.warn("[Dev Server] Auth updateUser warning:", authErr.message);
    }

    // 2. Update Firestore documents atomically
    const batch = firestore.batch();

    // Mark request verified
    batch.update(reqDoc.ref, {
      status: "verified",
      verifiedAt: new Date().toISOString(),
    });

    // Update /users/{uid}
    const userDocRef = firestore.collection("users").doc(targetUid);
    batch.set(
      userDocRef,
      {
        email: newEmail,
        emailVerified: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Update /emailIndex
    if (oldEmail) {
      batch.delete(firestore.collection("emailIndex").doc(oldEmail.toLowerCase()));
    }
    batch.set(firestore.collection("emailIndex").doc(newEmail.toLowerCase()), {
      uid: targetUid,
      email: newEmail,
      updatedAt: new Date().toISOString(),
    });

    // Add /users/{uid}/email_history
    const historyRef = userDocRef.collection("email_history").doc();
    batch.set(historyRef, {
      oldEmail,
      newEmail,
      timestamp: new Date().toISOString(),
      requestId: reqId,
      verifiedVia: "server_dev_verify",
    });

    await batch.commit();

    console.log(`[Dev Server] Verified and updated email for ${targetUid} -> ${newEmail}`);

    sendJson(res, {
      success: true,
      verified: true,
      completed: true,
      uid: targetUid,
      oldEmail,
      newEmail,
      customToken,
      message: "New email address verified and updated successfully!",
    });
  } catch (err: any) {
    console.error("[Dev Server] Verification error:", err);
    sendJson(res, { error: err?.message || "Failed to process verification." }, 500);
  }
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
    sendJson(res, {
      success: true,
      uid,
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

  const app = getFirebaseAdminApp();
  const firestore = app ? getFirestore(app) : null;

  if (firestore && reqId) {
    try {
      await firestore.collection("emailChangeRequests").doc(reqId).update({
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      });
    } catch {}
  }

  sendJson(res, {
    success: true,
    message: "Email change cancelled.",
  });
}
