import {
  jsonResponse,
  errorResponse,
  hashToken,
  type Env,
} from "./_common";
import { adminUpdateUserEmail, adminCreateCustomToken } from "./_firebase-admin";
import {
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreDeleteDoc,
} from "./_firestore";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const url = new URL(context.request.url);
  const reqId = url.searchParams.get("reqId") || url.searchParams.get("requestId") || "";
  const token = url.searchParams.get("token") || url.searchParams.get("oobCode") || "";
  const uid = url.searchParams.get("uid") || "";

  return processVerification({ reqId, token, uid, env: context.env, isGet: true });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const body: any = await request.json().catch(() => ({}));
  const reqId = (body.reqId || body.requestId || "").trim();
  const uid = (body.uid || "").trim();
  const token = (body.token || body.oobCode || "").trim();

  return processVerification({ reqId, token, uid, env, isGet: false });
}

async function processVerification({
  reqId,
  token,
  uid,
  env,
  isGet = false,
}: {
  reqId: string;
  token: string;
  uid: string;
  env: Env;
  isGet?: boolean;
}): Promise<Response> {
  try {
    if (!reqId || !token) {
      return errorResponse("Missing required parameters: reqId and token are required.", 400);
    }

    // 1. Fetch emailChangeRequests/{reqId}
    const reqDoc = await firestoreGetDoc(`emailChangeRequests/${reqId}`, env);
    if (!reqDoc) {
      return errorResponse("Verification link is invalid or has already been used.", 404);
    }

    // 2. Validate user ID match if provided
    if (uid && reqDoc.userId && uid !== reqDoc.userId) {
      return errorResponse("This verification link does not belong to the requested account.", 403);
    }

    const effectiveUid = reqDoc.userId;
    const now = Date.now();

    // 3. Status checks
    if (reqDoc.status === "cancelled") {
      return errorResponse("This email change request has been cancelled.", 410, { code: "cancelled" });
    }
    if (reqDoc.status === "superseded") {
      return errorResponse(
        "A newer verification email was dispatched. Please check your inbox for the latest link.",
        410,
        { code: "superseded" }
      );
    }
    if (reqDoc.status === "completed") {
      let customToken = "";
      try {
        customToken = await adminCreateCustomToken(env, effectiveUid);
      } catch (tokErr) {
        console.warn("[COMPLETED REQ CUSTOM TOKEN NOTICE]", tokErr);
      }
      return jsonResponse({
        success: true,
        alreadyCompleted: true,
        oldEmail: reqDoc.oldEmail,
        newEmail: reqDoc.newEmail,
        customToken,
        message: "Email address change has already been verified and completed.",
      });
    }

    // 4. Server-enforced Expiration Check (5-minute TTL)
    if (reqDoc.status === "expired" || now > (reqDoc.expiresAt || 0)) {
      if (reqDoc.status !== "expired") {
        await firestoreSetDoc(
          `emailChangeRequests/${reqId}`,
          { status: "expired", updatedAt: now },
          env
        );
      }
      return errorResponse(
        "This verification link has expired. Please return to LinkCloud and request a new one.",
        410,
        { code: "expired" }
      );
    }

    // 5. Secure Token Hash Comparison
    const computedHash = await hashToken(token);
    if (reqDoc.tokenHash && computedHash !== reqDoc.tokenHash) {
      return errorResponse("This verification token is invalid.", 403, { code: "invalid_token" });
    }

    const newEmail = (reqDoc.newEmail || "").trim().toLowerCase();
    const oldEmail = (reqDoc.oldEmail || "").trim().toLowerCase();

    // 6. Update Firebase Auth using Firebase Admin SDK (Identity Toolkit)
    try {
      await adminUpdateUserEmail(effectiveUid, newEmail, env);
      console.log(`[VERIFY SUCCESS] Firebase Auth email updated for UID ${effectiveUid} -> ${newEmail}`);
    } catch (adminAuthErr: any) {
      console.error("[VERIFY ADMIN AUTH UPDATE ERROR]", adminAuthErr);
      return errorResponse(`Failed to update authentication email: ${adminAuthErr.message}`, 500);
    }

    // 7. Update Firestore Request Document to completed
    await firestoreSetDoc(
      `emailChangeRequests/${reqId}`,
      {
        status: "completed",
        verifiedAt: now,
        completedAt: now,
        updatedAt: now,
      },
      env
    );

    // 8. Update user's active change record
    await firestoreSetDoc(
      `users/${effectiveUid}/emailChanges/active`,
      {
        status: "COMPLETED",
        targetEmail: newEmail,
        verifiedAt: now,
        completedAt: now,
        updatedAt: now,
      },
      env
    );

    // 9. Update user profile document in Firestore (commit new email and clear pending)
    await firestoreSetDoc(
      `users/${effectiveUid}`,
      {
        email: newEmail,
        emailVerified: true,
        emailIndex: newEmail,
        pendingEmail: null,
        activeEmailChangeRequestId: null,
        updatedAt: new Date().toISOString(),
      },
      env
    );

    // 10. Synchronize emailIndex collection (delete old, create new)
    if (oldEmail && oldEmail !== newEmail) {
      try {
        const oldIndexDoc = await firestoreGetDoc(`emailIndex/${oldEmail}`, env);
        if (oldIndexDoc && (oldIndexDoc.uid === effectiveUid || oldIndexDoc.userId === effectiveUid)) {
          await firestoreDeleteDoc(`emailIndex/${oldEmail}`, env);
        }
      } catch (delErr) {
        console.warn("[EMAIL INDEX CLEANUP NOTICE]", delErr);
      }
    }

    try {
      await firestoreSetDoc(
        `emailIndex/${newEmail}`,
        {
          uid: effectiveUid,
          email: newEmail,
          status: "active",
          updatedAt: new Date().toISOString(),
        },
        env
      );
    } catch (setIndexErr) {
      console.warn("[EMAIL INDEX SET NOTICE]", setIndexErr);
    }

    let customToken = "";
    try {
      customToken = await adminCreateCustomToken(env, effectiveUid);
      console.log(`[VERIFY CUSTOM TOKEN] Successfully minted custom token for UID ${effectiveUid}`);
    } catch (tokErr: any) {
      console.warn("[VERIFY CUSTOM TOKEN NOTICE]", tokErr);
    }

    return jsonResponse({
      success: true,
      verified: true,
      completed: true,
      uid: effectiveUid,
      oldEmail,
      newEmail,
      customToken,
      message: "New email address verified and updated successfully!",
    });
  } catch (err: any) {
    console.error("[VERIFY EMAIL CHANGE ERROR]", err);
    return errorResponse(err.message || "Internal server error", 500);
  }
}
