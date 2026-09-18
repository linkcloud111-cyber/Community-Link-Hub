import {
  jsonResponse,
  errorResponse,
  generateSecureToken,
  hashToken,
  type Env,
} from "./_common";
import { verifyFirebaseIdToken } from "./_firebase-admin";
import { firestoreGetDoc, firestoreSetDoc } from "./_firestore";
import { sendEmailViaResend, buildEmailChangeTemplate } from "./_resend";

const COOLDOWN_MS = 30 * 1000; // 30 seconds
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

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

  try {
    // 1. Verify Authorization Header (Firebase ID token)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid Authorization header", 401);
    }
    const idToken = authHeader.split("Bearer ")[1].trim();
    if (!idToken) {
      return errorResponse("Missing ID token in Authorization header", 401);
    }

    let decodedUser: { uid: string; email?: string };
    try {
      decodedUser = await verifyFirebaseIdToken(idToken, env);
    } catch (authErr: any) {
      return errorResponse(`Authentication failed: ${authErr.message}`, 401);
    }

    const uid = decodedUser.uid;
    const body: any = await request.json().catch(() => ({}));
    const pendingEmail = (body.pendingEmail || "").trim().toLowerCase();

    // 2. Fetch active request state from Firestore
    const activeDoc = await firestoreGetDoc(`users/${uid}/emailChanges/active`, env);
    if (!activeDoc || !activeDoc.targetEmail) {
      return errorResponse("No active email change request found to resend.", 404);
    }

    const targetEmail = (activeDoc.targetEmail || pendingEmail).trim().toLowerCase();

    // Check if already verified
    if (activeDoc.status === "VERIFIED" || activeDoc.status === "COMPLETED") {
      return errorResponse(
        "Email verification has already been completed. Please click 'Refresh Verification Status' in your LinkCloud dashboard to complete the change.",
        400
      );
    }

    // 3. Cooldown Check (30 seconds)
    const now = Date.now();
    const lastSentAt = activeDoc.createdAt || activeDoc.updatedAt || 0;
    if (now - lastSentAt < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now - lastSentAt)) / 1000);
      return errorResponse(
        `Please wait ${waitSec}s before requesting another verification email.`,
        429,
        { retryAfter: waitSec },
        { "Retry-After": String(waitSec) }
      );
    }

    // 4. Supersede old request and create new token with fresh 5-minute TTL
    if (activeDoc.requestId) {
      await firestoreSetDoc(
        `emailChangeRequests/${activeDoc.requestId}`,
        { status: "superseded", updatedAt: now },
        env
      );
    }

    const rawToken = generateSecureToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = now + EXPIRY_MS; // 5 minutes
    const newRequestId = `req_${uid}_${now}`;
    const nextVersion = (activeDoc.version || 1) + 1;

    await firestoreSetDoc(
      `emailChangeRequests/${newRequestId}`,
      {
        requestId: newRequestId,
        userId: uid,
        oldEmail: decodedUser.email || "",
        newEmail: targetEmail,
        tokenHash,
        status: "pending",
        createdAt: now,
        expiresAt,
        version: nextVersion,
        updatedAt: now,
      },
      env
    );

    await firestoreSetDoc(
      `users/${uid}/emailChanges/active`,
      {
        requestId: newRequestId,
        status: "PENDING",
        targetEmail,
        createdAt: now,
        expiresAt,
        version: nextVersion,
        updatedAt: now,
      },
      env
    );

    // 5. Send verification email via Resend
    const origin =
      env.APP_URL ||
      env.VITE_APP_URL ||
      new URL(request.url).origin ||
      "https://linkcloud.in";

    const verificationLink = `${origin}/verify-handler?mode=verifyAndChangeEmail&reqId=${newRequestId}&uid=${uid}&token=${rawToken}`;

    const html = buildEmailChangeTemplate({
      verificationLink,
      newEmail: targetEmail,
      expiresInMinutes: 5,
    });

    try {
      await sendEmailViaResend({
        to: targetEmail,
        subject: "Confirm your LinkCloud email change",
        html,
        env,
      });
    } catch (emailErr: any) {
      console.error("[EMAIL RESEND FAILED]", emailErr);
      await firestoreSetDoc(
        `emailChangeRequests/${newRequestId}`,
        { status: "cancelled", updatedAt: Date.now() },
        env
      );
      return errorResponse(`Failed to resend verification email: ${emailErr.message}`, 500);
    }

    return jsonResponse({
      success: true,
      requestId: newRequestId,
      expiresAt,
      newEmail: targetEmail,
      nextAllowedAt: now + COOLDOWN_MS,
      message: "New verification email dispatched. Link is valid for 5 minutes.",
    });
  } catch (err: any) {
    console.error("[RESEND EMAIL CHANGE ERROR]", err);
    return errorResponse(err.message || "Internal server error", 500);
  }
}
