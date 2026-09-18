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
    const newEmail = (body.newEmail || "").trim().toLowerCase();

    // 2. Validate email structure & Gmail-only constraint
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return errorResponse("Please enter a valid email address.", 400);
    }
    if (!newEmail.endsWith("@gmail.com")) {
      return errorResponse("Only personal Gmail addresses (@gmail.com) are supported.", 400);
    }

    const currentEmail = (decodedUser.email || body.currentEmail || "").trim().toLowerCase();
    if (currentEmail && newEmail === currentEmail) {
      return errorResponse("New email must be different from your current email.", 400);
    }

    // 3. Check email uniqueness in emailIndex
    const emailIndexDoc = await firestoreGetDoc(`emailIndex/${newEmail}`, env);
    if (emailIndexDoc && emailIndexDoc.uid && emailIndexDoc.uid !== uid) {
      return errorResponse("This Gmail address is already registered to another account.", 409);
    }

    // 4. Rate-limiting / Cooldown Check (30 seconds)
    const now = Date.now();
    const activeDoc = await firestoreGetDoc(`users/${uid}/emailChanges/active`, env);
    if (activeDoc) {
      const lastRequestedAt = activeDoc.createdAt || activeDoc.lastRequestedAt || activeDoc.updatedAt || 0;
      if (now - lastRequestedAt < COOLDOWN_MS) {
        const waitSec = Math.ceil((COOLDOWN_MS - (now - lastRequestedAt)) / 1000);
        return errorResponse(
          `Please wait ${waitSec}s before requesting another verification email.`,
          429,
          { retryAfter: waitSec },
          { "Retry-After": String(waitSec) }
        );
      }
    }

    // 5. Generate secure token & hash
    const rawToken = generateSecureToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = now + EXPIRY_MS; // 5 minutes
    const requestId = `req_${uid}_${now}`;

    // 6. Save email change request state to Firestore
    await firestoreSetDoc(
      `emailChangeRequests/${requestId}`,
      {
        requestId,
        userId: uid,
        oldEmail: currentEmail,
        newEmail,
        tokenHash,
        status: "pending",
        createdAt: now,
        expiresAt,
        version: 1,
        updatedAt: now,
      },
      env
    );

    await firestoreSetDoc(
      `users/${uid}/emailChanges/active`,
      {
        requestId,
        status: "PENDING",
        targetEmail: newEmail,
        createdAt: now,
        expiresAt,
        version: 1,
        updatedAt: now,
      },
      env
    );

    // 7. Compose verification link and send email via Resend
    const origin =
      env.APP_URL ||
      env.VITE_APP_URL ||
      new URL(request.url).origin ||
      "https://linkcloud.in";

    const verificationLink = `${origin}/verify-handler?mode=verifyAndChangeEmail&reqId=${requestId}&uid=${uid}&token=${rawToken}`;

    const html = buildEmailChangeTemplate({
      verificationLink,
      newEmail,
      expiresInMinutes: 5,
    });

    try {
      await sendEmailViaResend({
        to: newEmail,
        subject: "Confirm your LinkCloud email change",
        html,
        env,
      });
    } catch (emailErr: any) {
      console.error("[EMAIL RESEND FAILED]", emailErr);
      // Mark request as failed/cancelled
      await firestoreSetDoc(
        `emailChangeRequests/${requestId}`,
        { status: "cancelled", updatedAt: Date.now() },
        env
      );
      return errorResponse(`Failed to send verification email: ${emailErr.message}`, 500);
    }

    return jsonResponse({
      success: true,
      requestId,
      expiresAt,
      newEmail,
      nextAllowedAt: now + COOLDOWN_MS,
      message: "Verification email sent. Link is valid for 5 minutes.",
    });
  } catch (err: any) {
    console.error("[REQUEST EMAIL CHANGE ERROR]", err);
    return errorResponse(err.message || "Internal server error", 500);
  }
}
