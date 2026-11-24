import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import {
  getServiceAccount,
  getGoogleAccessToken,
  adminCreateCustomToken,
  verifyFirebaseIdToken,
} from "../email-change/_firebase-admin";
import { firestoreGetDoc, firestoreSetDoc } from "../email-change/_firestore";

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

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const { idToken } = body;
  if (!idToken) {
    return errorResponse("Missing required idToken", 400);
  }

  let decoded: any = {};
  try {
    decoded = await verifyFirebaseIdToken(idToken, env);
  } catch (err: any) {
    console.warn("[Cloudflare Auth] Phone token verification failed:", err?.message);
    return errorResponse("Invalid or expired authentication token.", 401);
  }

  const phoneNumber = (decoded.phone_number || "").trim();
  if (!phoneNumber) {
    return errorResponse("Phone number not verified in authentication token.", 400);
  }

  try {
    // Check existing user in mobileIndex (+91 canonical, +91 spaced, and legacy 10-digit formats)
    let existingIndex = await firestoreGetDoc(`mobileIndex/${encodeURIComponent(phoneNumber)}`, env);
    if (!existingIndex && phoneNumber.startsWith("+91")) {
      const raw10 = phoneNumber.slice(3).trim();
      existingIndex =
        (await firestoreGetDoc(`mobileIndex/${encodeURIComponent(`+91 ${raw10}`)}`, env)) ||
        (await firestoreGetDoc(`mobileIndex/${encodeURIComponent(raw10)}`, env));
    }
    if (!existingIndex && !phoneNumber.startsWith("+")) {
      existingIndex = await firestoreGetDoc(`mobileIndex/${encodeURIComponent(`+91${phoneNumber}`)}`, env);
    }
    if (existingIndex && existingIndex.uid) {
      const existingUid = String(existingIndex.uid).trim();
      const [userDoc, wmDoc] = await Promise.all([
        firestoreGetDoc(`users/${encodeURIComponent(existingUid)}`, env),
        firestoreGetDoc(`webmaster/${encodeURIComponent(existingUid)}`, env),
      ]);
      const status = String(userDoc?.status || "active");
      if (
        status === "deleted" ||
        status === "suspended" ||
        status === "banned" ||
        userDoc?.suspended === true ||
        userDoc?.banned === true
      ) {
        return errorResponse("Your account has been suspended or disabled. Please contact support.", 403);
      }

      const isWebmaster = Boolean(
        existingUid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
          userDoc?.role === "webmaster" ||
          (wmDoc && wmDoc.active !== false)
      );
      if (!isWebmaster) {
        const siteSettings = await firestoreGetDoc("settings/site", env);
        if (siteSettings && siteSettings.mobileOtpLoginEnabled === false) {
          return errorResponse("Mobile OTP login is currently disabled by the webmaster.", 403, {
            code: "AUTH_METHOD_DISABLED",
          });
        }
      }

      const customToken = await adminCreateCustomToken(env, existingUid, {
        accountUid: existingIndex.accountUid || userDoc?.accountUid || existingUid,
        role: isWebmaster ? "webmaster" : "user",
      });
      return jsonResponse({
        success: true,
        uid: existingUid,
        accountUid: existingIndex.accountUid || existingUid,
        customToken,
        isNew: false,
      });
    }

    // Check if phone matches canonical Webmaster (never locked out by auth toggles)
    const canonicalWebmasterUid = "OXGYTyWBcdYNcHkWyXPbOvVlV2h1";
    const webmasterDoc = await firestoreGetDoc(`users/${canonicalWebmasterUid}`, env);
    if (webmasterDoc) {
      const wmPhone = webmasterDoc.phone || "";
      if (wmPhone && (wmPhone === phoneNumber || wmPhone.replace(/\D/g, "") === phoneNumber.replace(/\D/g, ""))) {
        const customToken = await adminCreateCustomToken(env, canonicalWebmasterUid, {
          accountUid: "linkcloud334520",
          role: "webmaster",
        });
        return jsonResponse({
          success: true,
          uid: canonicalWebmasterUid,
          accountUid: "linkcloud334520",
          customToken,
          isNew: false,
        });
      }
    }

    // Enforce Webmaster mobileOtpLoginEnabled & userRegistrationEnabled before creating a new phone user (strict fail-closed)
    const siteSettings = await firestoreGetDoc("settings/site", env);
    if (siteSettings && siteSettings.mobileOtpLoginEnabled === false) {
      return errorResponse("Mobile OTP login is currently disabled by the webmaster.", 403, {
        code: "AUTH_METHOD_DISABLED",
      });
    }
    if (!siteSettings || typeof siteSettings !== "object" || siteSettings.userRegistrationEnabled !== true) {
      return errorResponse("New user registrations are currently closed by the webmaster.", 403);
    }

    // Allocate sequential UID
    const sequenceDoc = await firestoreGetDoc("counters/userSequence", env);
    let currentNumber = typeof sequenceDoc?.currentNumber === "number" ? sequenceDoc.currentNumber : 100;
    const prefix = sequenceDoc?.prefix || "linkcloud";

    let nextNumber = currentNumber + 1;
    let candidateUid = `${prefix}${nextNumber}`;

    let existingRegistry = await firestoreGetDoc(`accountUidRegistry/${encodeURIComponent(candidateUid)}`, env);
    while (existingRegistry) {
      nextNumber++;
      candidateUid = `${prefix}${nextNumber}`;
      existingRegistry = await firestoreGetDoc(`accountUidRegistry/${encodeURIComponent(candidateUid)}`, env);
    }

    const nowIso = new Date().toISOString();

    await firestoreSetDoc(
      "counters/userSequence",
      {
        currentNumber: nextNumber,
        prefix,
        updatedAt: nowIso,
        updatedBy: "system_provisioner",
      },
      env,
      true
    );

    await firestoreSetDoc(
      `accountUidRegistry/${encodeURIComponent(candidateUid)}`,
      {
        accountUid: candidateUid,
        firebaseUid: candidateUid,
        status: "active",
        activatedAt: nowIso,
      },
      env,
      false
    );

    // Create Firebase Auth user
    const sa = getServiceAccount(env);
    if (sa) {
      try {
        const accessToken = await getGoogleAccessToken(sa);
        await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            localId: candidateUid,
            phoneNumber,
            displayName: `User ${phoneNumber.slice(-4)}`,
          }),
        });

        // If temporary user existed, delete it
        if (decoded.uid && decoded.uid !== candidateUid) {
          await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ localId: decoded.uid }),
          }).catch(() => {});
        }
      } catch (e: any) {
        console.warn("[Cloudflare Auth] Phone signUp notice:", e.message);
      }
    }

    // Create /users/{candidateUid}
    await firestoreSetDoc(
      `users/${encodeURIComponent(candidateUid)}`,
      {
        uid: candidateUid,
        accountUid: candidateUid,
        displayName: `User ${phoneNumber.slice(-4)}`,
        email: "",
        phone: phoneNumber,
        photoURL: "",
        emailVerified: false,
        phoneVerified: true,
        role: "user",
        status: "active",
        groupCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      env,
      false
    );

    await firestoreSetDoc(
      `mobileIndex/${encodeURIComponent(phoneNumber)}`,
      {
        uid: candidateUid,
        phone: phoneNumber,
        createdAt: nowIso,
      },
      env,
      false
    );

    const customToken = await adminCreateCustomToken(env, candidateUid, {
      accountUid: candidateUid,
      role: "user",
    });

    return jsonResponse({
      success: true,
      uid: candidateUid,
      accountUid: candidateUid,
      customToken,
      isNew: true,
    });
  } catch (err: any) {
    const msg = String(err?.message || "");
    const isTransient =
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("DEADLINE_EXCEEDED") ||
      msg.includes("429") ||
      msg.includes("503");
    console.error("[Cloudflare Auth] Phone provision failure:", msg || "unexpected");
    return errorResponse(
      isTransient
        ? "Authentication service is temporarily busy. Please try again in a moment."
        : "Authentication failed. Please try again.",
      isTransient ? 503 : 500
    );
  }
}
