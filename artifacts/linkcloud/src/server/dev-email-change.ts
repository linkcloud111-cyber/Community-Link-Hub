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
        createdAt: now,
        createdAtMs: now,
        updatedAt: now,
        status: "pending",
      });

      const activeRef = firestore.collection("users").doc(uid).collection("emailChanges").doc("active");
      batch.set(activeRef, {
        requestId,
        status: "PENDING",
        targetEmail: newEmail,
        createdAt: now,
        expiresAt,
        updatedAt: now,
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
  if (!resendApiKey) {
    console.log(`[Dev Server] Dev Verification link: ${verificationLink}`);
  }

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
    ...(resendApiKey ? {} : { devVerificationLink: verificationLink }),
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

  if (!reqId || !rawToken) {
    sendJson(res, { error: "Missing required parameters: reqId and token are required." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  const firestore = app ? getFirestore(app) : null;
  const now = Date.now();

  if (!firestore || !app) {
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
    if (uid && reqData.userId && uid !== reqData.userId) {
      sendJson(res, { error: "This verification link does not belong to the requested account." }, 403);
      return;
    }

    const reqStatus = String(reqData.status || "").toLowerCase();
    if (reqStatus === "cancelled") {
      sendJson(res, { error: "This email change request has been cancelled.", details: { code: "cancelled" } }, 410);
      return;
    }
    if (reqStatus === "superseded") {
      sendJson(res, { error: "A newer verification email was dispatched.", details: { code: "superseded" } }, 410);
      return;
    }

    // Verify token hash BEFORE returning completed status or minting customToken
    const expectedHash = hashToken(rawToken);
    if (!reqData.tokenHash || reqData.tokenHash !== expectedHash) {
      sendJson(res, { error: "Invalid verification token." }, 403);
      return;
    }

    if (reqStatus === "verified" || reqStatus === "completed") {
      let customToken = "";
      try {
        customToken = await getAuth(app).createCustomToken(reqData.userId);
      } catch {}
      sendJson(res, {
        success: true,
        alreadyCompleted: true,
        verified: true,
        completed: true,
        uid: reqData.userId,
        oldEmail: reqData.oldEmail,
        newEmail: reqData.newEmail,
        customToken,
        message: "Email change already completed.",
      });
      return;
    }

    if (reqStatus === "expired" || reqData.expiresAt < now) {
      await reqDoc.ref.update({ status: "expired", updatedAt: now });
      sendJson(res, { error: "This verification link has expired. Please request a new one.", details: { code: "expired" } }, 410);
      return;
    }

    const targetUid = reqData.userId;
    const oldEmail = (reqData.oldEmail || "").trim().toLowerCase();
    const newEmail = (reqData.newEmail || "").trim().toLowerCase();

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

    // Mark request completed
    batch.update(reqDoc.ref, {
      status: "completed",
      verifiedAt: now,
      completedAt: now,
      updatedAt: now,
    });

    const activeRef = firestore.collection("users").doc(targetUid).collection("emailChanges").doc("active");
    batch.set(
      activeRef,
      {
        status: "COMPLETED",
        targetEmail: newEmail,
        verifiedAt: now,
        completedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    // Update /users/{uid} and clear pending flags
    const userDocRef = firestore.collection("users").doc(targetUid);
    batch.set(
      userDocRef,
      {
        email: newEmail,
        emailVerified: true,
        emailIndex: newEmail,
        pendingEmail: null,
        activeEmailChangeRequestId: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Update /emailIndex
    if (oldEmail && oldEmail !== newEmail) {
      batch.delete(firestore.collection("emailIndex").doc(oldEmail));
    }
    batch.set(firestore.collection("emailIndex").doc(newEmail), {
      uid: targetUid,
      email: newEmail,
      status: "active",
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

  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    sendJson(res, { error: "Authentication required: Missing Bearer token." }, 401);
    return;
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    sendJson(res, { error: "Authentication required: Empty Bearer token." }, 401);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firebase Admin is not configured on dev server." }, 500);
    return;
  }

  let decodedUid = "";
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    decodedUid = decoded.uid;
  } catch (authErr: any) {
    sendJson(res, { error: `Authentication failed: ${authErr.message}` }, 401);
    return;
  }

  const body = await parseBody(req);
  const uid = (body.uid || decodedUid || "").trim();
  const reqId = (body.reqId || body.requestId || "").trim();

  if (!uid) {
    sendJson(res, { error: "Missing required parameter: uid." }, 400);
    return;
  }
  if (decodedUid !== uid) {
    sendJson(res, { error: "Forbidden: Authenticated user does not match requested uid." }, 403);
    return;
  }

  try {
    const firestore = getFirestore(app);
    let isCompleted = false;
    let newEmail = "";
    const now = Date.now();
    const MAX_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

    if (reqId) {
      const reqSnap = await firestore.collection("emailChangeRequests").doc(reqId).get();
      const reqData = reqSnap.data();
      const st = String(reqData?.status || "").toLowerCase();
      const verifiedAtMs = typeof reqData?.verifiedAt === "number" ? reqData.verifiedAt : (reqData?.verifiedAt ? new Date(reqData.verifiedAt).getTime() : 0);
      if (
        reqSnap.exists &&
        reqData?.userId === uid &&
        (st === "completed" || st === "verified") &&
        (!verifiedAtMs || now - verifiedAtMs <= MAX_REFRESH_WINDOW_MS)
      ) {
        isCompleted = true;
        newEmail = reqData?.newEmail || "";
      }
    }

    if (!isCompleted) {
      const activeSnap = await firestore.collection("users").doc(uid).collection("emailChanges").doc("active").get();
      const activeData = activeSnap.data();
      const st = String(activeData?.status || "").toLowerCase();
      const verifiedAtMs = typeof activeData?.verifiedAt === "number" ? activeData.verifiedAt : (activeData?.verifiedAt ? new Date(activeData.verifiedAt).getTime() : 0);
      if (
        activeSnap.exists &&
        (st === "completed" || st === "verified") &&
        (!verifiedAtMs || now - verifiedAtMs <= MAX_REFRESH_WINDOW_MS)
      ) {
        isCompleted = true;
        newEmail = activeData?.targetEmail || activeData?.newEmail || "";
      }
    }

    if (!isCompleted) {
      sendJson(res, { error: "No recently completed email change request found for this account." }, 404);
      return;
    }

    const customToken = await getAuth(app).createCustomToken(uid);
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

  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    sendJson(res, { error: "Authentication required: Missing Bearer token." }, 401);
    return;
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
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
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (authErr: any) {
    sendJson(res, { error: `Authentication failed: ${authErr.message}` }, 401);
    return;
  }

  const body = await parseBody(req);
  const reqId = (body.reqId || body.requestId || "").trim();
  const firestore = getFirestore(app);
  const now = Date.now();

  try {
    const activeRef = firestore.collection("users").doc(uid).collection("emailChanges").doc("active");
    const activeSnap = await activeRef.get();
    const targetReqId = reqId || activeSnap.data()?.requestId || "";

    if (targetReqId) {
      const reqRef = firestore.collection("emailChangeRequests").doc(targetReqId);
      const reqSnap = await reqRef.get();
      if (reqSnap.exists) {
        const reqData = reqSnap.data()!;
        if (reqData.userId !== uid) {
          sendJson(res, { error: "Forbidden: Cannot cancel another user's email change request." }, 403);
          return;
        }
        const st = String(reqData.status || "").toLowerCase();
        if (st === "verified" || st === "completed") {
          sendJson(res, { error: "Email change has already been verified and cannot be cancelled." }, 400);
          return;
        }
        await reqRef.update({ status: "cancelled", updatedAt: now, cancelledAt: new Date().toISOString() });
      }
    }

    await activeRef.set({ status: "CANCELLED", updatedAt: now }, { merge: true });
    await firestore.collection("users").doc(uid).set(
      {
        pendingEmail: null,
        activeEmailChangeRequestId: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    sendJson(res, {
      success: true,
      message: "Email change cancelled.",
    });
  } catch (err: any) {
    console.error("[Dev Server] Cancel email change error:", err);
    sendJson(res, { error: err?.message || "Failed to cancel email change." }, 500);
  }
}
