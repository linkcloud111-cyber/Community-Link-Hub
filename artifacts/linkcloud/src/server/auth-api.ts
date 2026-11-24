import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { getFirebaseAdminApp } from "./admin-api.ts";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { normalizeIndianMobileNumber } from "../lib/group-validation.ts";

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

/**
 * Atomically allocates the next canonical sequential UID (linkcloud101, linkcloud102, ...)
 * using the Firestore document /counters/userSequence.
 */
export async function allocateNextSequentialUid(): Promise<string> {
  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error("Firebase Admin SDK is not initialized.");
  }

  const firestore = getFirestore(app);
  const counterRef = firestore.collection("counters").doc("userSequence");

  const allocatedUid = await firestore.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    let currentNumber = 100;
    let prefix = "linkcloud";

    if (counterSnap.exists) {
      const data = counterSnap.data() || {};
      currentNumber = typeof data.currentNumber === "number" ? data.currentNumber : 100;
      prefix = data.prefix || "linkcloud";
    }

    let nextNumber = currentNumber + 1;
    let candidateUid = `${prefix}${nextNumber}`;

    // Verify candidate is not already registered
    let registryRef = firestore.collection("accountUidRegistry").doc(candidateUid);
    let registrySnap = await tx.get(registryRef);

    while (registrySnap.exists) {
      nextNumber++;
      candidateUid = `${prefix}${nextNumber}`;
      registryRef = firestore.collection("accountUidRegistry").doc(candidateUid);
      registrySnap = await tx.get(registryRef);
    }

    // Update sequence counter atomically
    tx.set(
      counterRef,
      {
        currentNumber: nextNumber,
        prefix,
        updatedAt: new Date().toISOString(),
        updatedBy: "system_provisioner",
      },
      { merge: true }
    );

    // Reserve candidate UID in registry
    tx.set(registryRef, {
      accountUid: candidateUid,
      firebaseUid: candidateUid,
      status: "reserved",
      allocatedAt: new Date().toISOString(),
    });

    return candidateUid;
  });

  return allocatedUid;
}

/**
 * Fail-closed evaluator for the Webmaster `userRegistrationEnabled` flag.
 * Only strictly boolean `true` permits new account creation.
 * Missing, null, false, or malformed values fail closed with HTTP 403.
 */
export function evaluateRegistrationGuard(siteSettings: unknown): {
  allowed: boolean;
  status?: number;
  error?: string;
} {
  if (
    !siteSettings ||
    typeof siteSettings !== "object" ||
    Array.isArray(siteSettings) ||
    (siteSettings as Record<string, unknown>).userRegistrationEnabled !== true
  ) {
    return {
      allowed: false,
      status: 403,
      error: "New user registrations are currently closed by the webmaster.",
    };
  }
  return { allowed: true };
}

export async function handleAuthProvisionUser(
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
  const { fullName, dob, email, phone, password } = body;

  // Enforce Webmaster userRegistrationEnabled setting server-side (strict fail-closed)
  const adminAppForSettings = getFirebaseAdminApp();
  if (!adminAppForSettings) {
    sendJson(res, { error: "Registration service is temporarily unavailable. Please try again." }, 503);
    return;
  }

  try {
    const siteSnap = await getFirestore(adminAppForSettings).doc("settings/site").get();
    const guard = evaluateRegistrationGuard(siteSnap.exists ? siteSnap.data() : null);
    if (!guard.allowed) {
      sendJson(res, { error: guard.error }, guard.status || 403);
      return;
    }
  } catch (err) {
    console.error("[Auth API] Failed to verify userRegistrationEnabled setting:", err);
    sendJson(res, { error: "Unable to verify registration availability. Please try again." }, 503);
    return;
  }

  // 1. Validations
  const cleanName = typeof fullName === "string" ? fullName.trim() : "";
  if (cleanName.length < 3) {
    sendJson(res, { error: "Full Name must contain at least 3 letters." }, 400);
    return;
  }

  if (!dob || typeof dob !== "string") {
    sendJson(res, { error: "Date of Birth is required." }, 400);
    return;
  }
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (isNaN(age) || age < 18) {
    sendJson(res, { error: "You must be at least 18 years old." }, 400);
    return;
  }

  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!cleanEmail.endsWith("@gmail.com") || !/^[a-zA-Z0-9.]+@gmail\.com$/.test(cleanEmail)) {
    sendJson(res, { error: "Only valid personal Gmail addresses (@gmail.com) are allowed." }, 400);
    return;
  }

  let cleanPhone = typeof phone === "string" ? phone.replace(/[\s\-\(\)]/g, "") : "";
  if (!cleanPhone.startsWith("+91")) {
    if (cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone)) {
      cleanPhone = `+91${cleanPhone}`;
    } else {
      sendJson(res, { error: "Enter a valid 10-digit Indian mobile number." }, 400);
      return;
    }
  }
  if (!/^\+91[6-9]\d{9}$/.test(cleanPhone)) {
    sendJson(res, { error: "Enter a valid Indian mobile number starting with 6, 7, 8, or 9." }, 400);
    return;
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    sendJson(res, { error: "Password must be at least 8 characters long." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);

  try {
    // 2. Duplicate checks in Firestore indexes (unified safe 409 prevents email/phone enumeration)
    const SAFE_CONFLICT_MSG =
      "Unable to complete registration with the provided details. If you already have an account, please sign in.";

    const emailIndexRef = firestore.collection("emailIndex").doc(cleanEmail);
    const emailIndexSnap = await emailIndexRef.get();
    if (emailIndexSnap.exists) {
      sendJson(res, { error: SAFE_CONFLICT_MSG }, 409);
      return;
    }

    const mobileIndexRef = firestore.collection("mobileIndex").doc(cleanPhone);
    const mobileIndexSnap = await mobileIndexRef.get();
    if (mobileIndexSnap.exists) {
      sendJson(res, { error: SAFE_CONFLICT_MSG }, 409);
      return;
    }

    // Check Firebase Auth duplicate
    try {
      const existingUser = await auth.getUserByEmail(cleanEmail);
      if (existingUser) {
        sendJson(res, { error: SAFE_CONFLICT_MSG }, 409);
        return;
      }
    } catch (authLookupErr: any) {
      if (authLookupErr?.code !== "auth/user-not-found") {
        console.warn("[Auth API] Auth lookup note:", authLookupErr.message);
      }
    }

    // 3. Atomically allocate next sequential UID
    const canonicalUid = await allocateNextSequentialUid();

    // 4. Create user in Firebase Auth with exact canonical UID
    await auth.createUser({
      uid: canonicalUid,
      email: cleanEmail,
      password,
      displayName: cleanName,
      emailVerified: false,
      disabled: false,
    });

    const nowIso = new Date().toISOString();

    // 5. Create Firestore documents atomically using batch
    const batch = firestore.batch();

    // /users/{canonicalUid}
    const userDocRef = firestore.collection("users").doc(canonicalUid);
    batch.set(userDocRef, {
      uid: canonicalUid,
      accountUid: canonicalUid,
      displayName: cleanName,
      dob,
      email: cleanEmail,
      phone: cleanPhone,
      photoURL: "",
      emailVerified: false,
      phoneVerified: false,
      role: "user",
      status: "pending_verification",
      groupCount: 0,
      registrationCreatedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // /pendingRegistrations/{canonicalUid}
    const pendingRegRef = firestore.collection("pendingRegistrations").doc(canonicalUid);
    batch.set(pendingRegRef, {
      uid: canonicalUid,
      email: cleanEmail,
      phone: cleanPhone,
      registrationCreatedAt: nowIso,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      status: "pending_verification",
    });

    // /emailIndex/{email}
    batch.set(emailIndexRef, {
      uid: canonicalUid,
      email: cleanEmail,
      createdAt: nowIso,
    });

    // /mobileIndex/{phone}
    batch.set(mobileIndexRef, {
      uid: canonicalUid,
      phone: cleanPhone,
      createdAt: nowIso,
    });

    // Update /accountUidRegistry/{canonicalUid} to active
    const registryRef = firestore.collection("accountUidRegistry").doc(canonicalUid);
    batch.set(
      registryRef,
      {
        accountUid: canonicalUid,
        firebaseUid: canonicalUid,
        status: "active",
        activatedAt: nowIso,
      },
      { merge: true }
    );

    // /audit_logs/{logId}
    const auditLogRef = firestore.collection("audit_logs").doc();
    batch.set(auditLogRef, {
      action: "USER_PROVISIONED",
      targetUid: canonicalUid,
      actorUid: "system",
      details: {
        email: cleanEmail,
        phone: cleanPhone,
        accountUid: canonicalUid,
      },
      createdAt: nowIso,
      timestamp: nowIso,
    });

    await batch.commit();

    // 6. Mint custom token for client sign-in
    const customToken = await auth.createCustomToken(canonicalUid, {
      accountUid: canonicalUid,
      role: "user",
    });

    console.log("[Auth API] Successfully provisioned canonical user:", {
      uid: canonicalUid,
      email: cleanEmail,
    });

    sendJson(res, {
      success: true,
      uid: canonicalUid,
      accountUid: canonicalUid,
      customToken,
      message: "User successfully provisioned with canonical UID.",
    });
  } catch (err: any) {
    console.error("[Auth API] User provisioning error:", err);
    sendJson(
      res,
      {
        success: false,
        error: "Unable to complete registration. Please try again later.",
      },
      500
    );
  }
}

export async function handleAuthProvisionGoogleUser(
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
  const { idToken } = body;

  if (!idToken || typeof idToken !== "string") {
    sendJson(res, { error: "Missing required idToken." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const googleEmail = (decoded.email || "").trim().toLowerCase();
    const googleName = decoded.name || decoded.displayName || "Google User";
    const googlePicture = decoded.picture || "";

    if (!googleEmail) {
      sendJson(res, { error: "Google account does not contain a verified email." }, 400);
      return;
    }

    // Check if user exists in emailIndex or users collection
    const emailIndexRef = firestore.collection("emailIndex").doc(googleEmail);
    const emailIndexSnap = await emailIndexRef.get();

    if (emailIndexSnap.exists) {
      const existingUid = emailIndexSnap.data()?.uid;
      if (existingUid) {
        const [userSnap, wmSnap] = await Promise.all([
          firestore.collection("users").doc(existingUid).get(),
          firestore.collection("webmaster").doc(existingUid).get(),
        ]);
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const status = String(userData.status || "active");
        if (
          status === "deleted" ||
          status === "suspended" ||
          status === "banned" ||
          userData.suspended === true ||
          userData.banned === true
        ) {
          sendJson(
            res,
            { success: false, error: "Your account has been suspended or disabled. Please contact support." },
            403
          );
          return;
        }
        const isWebmaster = Boolean(
          existingUid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
            userData.role === "webmaster" ||
            (wmSnap.exists && wmSnap.data()?.active !== false)
        );
        if (!isWebmaster) {
          const siteSnap = await firestore.doc("settings/site").get();
          const siteData = siteSnap.exists ? siteSnap.data() : null;
          if (siteData && siteData.googleLoginEnabled === false) {
            sendJson(
              res,
              {
                success: false,
                error: "Google sign-in is currently disabled by the webmaster.",
                code: "AUTH_METHOD_DISABLED",
              },
              403
            );
            return;
          }
        }
        const customToken = await auth.createCustomToken(existingUid, {
          accountUid: userData.accountUid || existingUid,
          role: isWebmaster ? "webmaster" : "user",
        });
        sendJson(res, {
          success: true,
          uid: existingUid,
          customToken,
          isNew: false,
        });
        return;
      }
    }

    // Registration-First Rule: If Google identity is not registered in LinkCloud, reject
    sendJson(
      res,
      {
        success: false,
        error: "Please register first. This Google account is not registered with LinkCloud.",
        code: "ACCOUNT_NOT_REGISTERED",
      },
      403
    );
    return;
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    const code = Number(err?.code);
    const isTransient =
      code === 8 ||
      code === 14 ||
      code === 4 ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("DEADLINE_EXCEEDED");
    console.error("[Auth API] Google provision error:", msg || err);
    sendJson(
      res,
      {
        success: false,
        error: isTransient
          ? "Authentication service is temporarily busy. Please try again in a moment."
          : "Authentication failed. Please try again.",
      },
      isTransient ? 503 : 500
    );
  }
}

export async function handleAuthProvisionPhoneUser(
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
  const { idToken } = body;

  if (!idToken || typeof idToken !== "string") {
    sendJson(res, { error: "Missing required idToken." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const phoneNumber = (decoded.phone_number || "").trim();

    if (!phoneNumber) {
      sendJson(res, { error: "Phone number not verified in authentication token." }, 400);
      return;
    }

    // Check if phone exists in mobileIndex (check +91, +91 spaced, and 10-digit formats)
    let mobileIndexSnap = await firestore.collection("mobileIndex").doc(phoneNumber).get();
    if (!mobileIndexSnap.exists && phoneNumber.startsWith("+91")) {
      const raw10 = phoneNumber.slice(3).trim();
      mobileIndexSnap = await firestore.collection("mobileIndex").doc(`+91 ${raw10}`).get();
      if (!mobileIndexSnap.exists) {
        mobileIndexSnap = await firestore.collection("mobileIndex").doc(raw10).get();
      }
    }
    if (!mobileIndexSnap.exists && !phoneNumber.startsWith("+")) {
      mobileIndexSnap = await firestore.collection("mobileIndex").doc(`+91${phoneNumber}`).get();
    }

    if (mobileIndexSnap.exists) {
      const existingData = mobileIndexSnap.data() || {};
      const existingUid = existingData.uid;
      if (existingUid) {
        const [userSnap, wmSnap] = await Promise.all([
          firestore.collection("users").doc(existingUid).get(),
          firestore.collection("webmaster").doc(existingUid).get(),
        ]);
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const status = String(userData.status || "active");
        if (
          status === "deleted" ||
          status === "suspended" ||
          status === "banned" ||
          userData.suspended === true ||
          userData.banned === true
        ) {
          sendJson(
            res,
            { success: false, error: "Your account has been suspended or disabled. Please contact support." },
            403
          );
          return;
        }
        const isWebmaster = Boolean(
          existingUid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
            userData.role === "webmaster" ||
            (wmSnap.exists && wmSnap.data()?.active !== false)
        );
        if (!isWebmaster) {
          const siteSnap = await firestore.doc("settings/site").get();
          const siteData = siteSnap.exists ? siteSnap.data() : null;
          if (siteData && siteData.mobileOtpLoginEnabled === false) {
            sendJson(
              res,
              {
                success: false,
                error: "Mobile OTP login is currently disabled by the webmaster.",
                code: "AUTH_METHOD_DISABLED",
              },
              403
            );
            return;
          }
        }
        const customToken = await auth.createCustomToken(existingUid, {
          accountUid: existingData.accountUid || userData.accountUid || existingUid,
          role: isWebmaster ? "webmaster" : "user",
        });
        sendJson(res, {
          success: true,
          uid: existingUid,
          accountUid: existingData.accountUid || existingUid,
          customToken,
          isNew: false,
        });
        return;
      }
    }

    // Check if phone matches canonical Webmaster (never locked out by auth toggles)
    const canonicalWebmasterUid = "OXGYTyWBcdYNcHkWyXPbOvVlV2h1";
    const webmasterDoc = await firestore.collection("users").doc(canonicalWebmasterUid).get();
    if (webmasterDoc.exists) {
      const wmPhone = webmasterDoc.data()?.phone || "";
      if (wmPhone && (wmPhone === phoneNumber || wmPhone.replace(/\D/g, "") === phoneNumber.replace(/\D/g, ""))) {
        const customToken = await auth.createCustomToken(canonicalWebmasterUid, {
          accountUid: "linkcloud334520",
          role: "webmaster",
        });
        sendJson(res, {
          success: true,
          uid: canonicalWebmasterUid,
          accountUid: "linkcloud334520",
          customToken,
          isNew: false,
        });
        return;
      }
    }

    // Enforce Webmaster mobileOtpLoginEnabled & userRegistrationEnabled before creating a new phone user (strict fail-closed)
    try {
      const siteSnap = await firestore.doc("settings/site").get();
      const siteData = siteSnap.exists ? siteSnap.data() : null;
      if (siteData && siteData.mobileOtpLoginEnabled === false) {
        sendJson(
          res,
          {
            success: false,
            error: "Mobile OTP login is currently disabled by the webmaster.",
            code: "AUTH_METHOD_DISABLED",
          },
          403
        );
        return;
      }
      const guard = evaluateRegistrationGuard(siteData);
      if (!guard.allowed) {
        sendJson(res, { success: false, error: guard.error }, guard.status || 403);
        return;
      }
    } catch (guardErr) {
      console.error("[Auth API] Failed to verify userRegistrationEnabled for phone signup:", guardErr);
      sendJson(res, { success: false, error: "Unable to verify registration availability. Please try again." }, 503);
      return;
    }

    // Allocate canonical sequential UID
    const canonicalUid = await allocateNextSequentialUid();
    const nowIso = new Date().toISOString();

    // Clean up temporary phone user if different from canonical UID first,
    // so that the phone number is released and can be bound to the canonical UID in Firebase Auth
    if (decoded.uid && decoded.uid !== canonicalUid) {
      try {
        await auth.deleteUser(decoded.uid);
      } catch (delErr: any) {
        console.warn("[Auth API] Temporary phone user cleanup note:", delErr.message);
      }
    }

    // Create user in Firebase Auth with canonical UID
    try {
      await auth.createUser({
        uid: canonicalUid,
        phoneNumber,
        displayName: `User ${phoneNumber.slice(-4)}`,
        disabled: false,
      });
    } catch (createErr: any) {
      console.warn("[Auth API] Phone createUser note:", createErr.message);
    }

    const batch = firestore.batch();

    // Create /users/{canonicalUid}
    const userDocRef = firestore.collection("users").doc(canonicalUid);
    batch.set(userDocRef, {
      uid: canonicalUid,
      accountUid: canonicalUid,
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
    });

    // /mobileIndex/{phone}
    const mobileIndexRef = firestore.collection("mobileIndex").doc(phoneNumber);
    batch.set(mobileIndexRef, {
      uid: canonicalUid,
      phone: phoneNumber,
      createdAt: nowIso,
    });

    // Update /accountUidRegistry/{canonicalUid}
    const registryRef = firestore.collection("accountUidRegistry").doc(canonicalUid);
    batch.set(
      registryRef,
      {
        accountUid: canonicalUid,
        firebaseUid: canonicalUid,
        status: "active",
        activatedAt: nowIso,
      },
      { merge: true }
    );

    // Audit log
    const auditLogRef = firestore.collection("audit_logs").doc();
    batch.set(auditLogRef, {
      action: "USER_PROVISIONED_PHONE",
      targetUid: canonicalUid,
      actorUid: "system",
      details: { phone: phoneNumber },
      createdAt: nowIso,
      timestamp: nowIso,
    });

    await batch.commit();

    const customToken = await auth.createCustomToken(canonicalUid, {
      accountUid: canonicalUid,
      role: "user",
    });

    sendJson(res, {
      success: true,
      uid: canonicalUid,
      accountUid: canonicalUid,
      customToken,
      isNew: true,
    });
  } catch (err: any) {
    console.error("[Auth API] Phone provision error:", err);
    sendJson(res, { success: false, error: "Unable to complete phone authentication. Please try again." }, 500);
  }
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const devRateLimitMap = new Map<string, RateLimitRecord>();
const DEV_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEV_MAX_REQUESTS_PER_WINDOW = 20;

function isDevRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = devRateLimitMap.get(ip);
  if (!record || record.resetAt <= now) {
    devRateLimitMap.set(ip, { count: 1, resetAt: now + DEV_RATE_LIMIT_WINDOW_MS });
    if (devRateLimitMap.size > 1000) {
      for (const [key, val] of devRateLimitMap.entries()) {
        if (val.resetAt <= now) devRateLimitMap.delete(key);
      }
    }
    return false;
  }
  record.count++;
  return record.count > DEV_MAX_REQUESTS_PER_WINDOW;
}

export async function handleAuthCheckRegistration(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed" }, 405);
    return;
  }

  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "local";
  if (isDevRateLimited(clientIp)) {
    sendJson(res, { error: "Too many requests. Please try again later." }, 429);
    return;
  }

  // Unauthenticated account-existence lookup is permanently disabled to prevent
  // Gmail enumeration via response body, status, or Firestore timing side-channels.
  sendJson(
    res,
    {
      error: "Account lookup is disabled to protect user privacy. Please sign in or reset your password directly.",
    },
    403
  );
}

const mobileIpRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const mobilePhoneIpRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MOBILE_IP_WINDOW_MS = 60 * 1000;
const MOBILE_IP_MAX = 25;
const MOBILE_PHONE_WINDOW_MS = 5 * 60 * 1000;
const MOBILE_PHONE_MAX = 10;

function isMobileRateLimited(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  max: number,
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
  return entry.count > max;
}

function resolveFirebaseWebApiKey(): string {
  const envKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (envKey && envKey.trim().length > 10) return envKey.trim();
  try {
    const cfgPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (parsed?.apiKey) return String(parsed.apiKey);
    }
    const nestedCfgPath = path.resolve(process.cwd(), "artifacts/linkcloud/firebase-applet-config.json");
    if (fs.existsSync(nestedCfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(nestedCfgPath, "utf8"));
      if (parsed?.apiKey) return String(parsed.apiKey);
    }
  } catch {
    // ignore
  }
  return "";
}

const GENERIC_MOBILE_LOGIN_ERROR = "Invalid mobile number or password.";

export async function handleAuthMobilePasswordLogin(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
    return;
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "local";

  if (isMobileRateLimited(mobileIpRateLimitMap, clientIp, MOBILE_IP_MAX, MOBILE_IP_WINDOW_MS)) {
    sendJson(res, { success: false, error: "Too many login attempts. Please wait a minute and try again." }, 429);
    return;
  }

  const body = await parseBody(req);
  const rawMobile =
    typeof body.mobile === "string"
      ? body.mobile
      : typeof body.phone === "string"
      ? body.phone
      : "";
  const password = typeof body.password === "string" ? body.password : "";
  const portal = body.portal === "webmaster" ? "webmaster" : "user";

  const norm = normalizeIndianMobileNumber(rawMobile);
  if (!norm.valid) {
    sendJson(res, { success: false, error: "Invalid mobile number. Please check and try again." }, 400);
    return;
  }
  if (!password) {
    sendJson(res, { success: false, error: "Please enter your password." }, 400);
    return;
  }

  const phoneRateKey = `${clientIp}:${norm.canonical}`;
  if (isMobileRateLimited(mobilePhoneIpRateLimitMap, phoneRateKey, MOBILE_PHONE_MAX, MOBILE_PHONE_WINDOW_MS)) {
    sendJson(
      res,
      { success: false, error: "Too many failed attempts for this mobile number. Please try again in a few minutes." },
      429
    );
    return;
  }

  const app = getFirebaseAdminApp();
  const webApiKey = resolveFirebaseWebApiKey();
  if (!app || !webApiKey) {
    sendJson(res, { success: false, error: "Authentication service is temporarily unavailable." }, 503);
    return;
  }

  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);

  try {
    // 1. Server-side resolve UID via mobileIndex (+91 canonical, +91 spaced, 10-digit legacy)
    let resolvedUid = "";
    for (const variation of norm.variations) {
      const snap = await firestore.collection("mobileIndex").doc(variation).get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (data.uid && data.status !== "deleted") {
          resolvedUid = String(data.uid).trim();
          break;
        }
      }
    }

    // Fallback for legacy users missing mobileIndex entries
    if (!resolvedUid) {
      const usersSnap = await firestore
        .collection("users")
        .where("phone", "in", norm.variations)
        .limit(3)
        .get();
      const activeDoc = usersSnap.docs.find((d) => d.data()?.status !== "deleted");
      if (activeDoc) {
        const data = activeDoc.data();
        resolvedUid = String(data?.uid || activeDoc.id).trim();
      }
    }

    if (!resolvedUid) {
      sendJson(res, { success: false, error: GENERIC_MOBILE_LOGIN_ERROR }, 401);
      return;
    }

    const userSnap = await firestore.collection("users").doc(resolvedUid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : null;

    let authRecord: { email?: string; disabled?: boolean } | null = null;
    try {
      const rec = await adminAuth.getUser(resolvedUid);
      authRecord = { email: rec.email, disabled: rec.disabled };
    } catch {
      authRecord = null;
    }

    const authEmail = String(authRecord?.email || userData?.email || "")
      .trim()
      .toLowerCase();

    if (!authEmail) {
      sendJson(res, { success: false, error: GENERIC_MOBILE_LOGIN_ERROR }, 401);
      return;
    }

    // 2. Verify password using Firebase Authentication Identity Toolkit REST API
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
        sendJson(res, { success: false, error: "Too many login attempts. Please try again later." }, 429);
        return;
      }
      sendJson(res, { success: false, error: GENERIC_MOBILE_LOGIN_ERROR }, 401);
      return;
    }

    // 3. Enforce account status after password succeeds
    const status = String(userData?.status || "active");
    if (status === "deleted" || authRecord?.disabled === true) {
      sendJson(res, { success: false, error: "This account has been suspended or disabled. Please contact support." }, 403);
      return;
    }
    if (status === "suspended" || status === "banned" || userData?.suspended === true || userData?.banned === true) {
      sendJson(res, { success: false, error: "Your account has been suspended or banned. Please contact support." }, 403);
      return;
    }

    // 4. Enforce portal role isolation
    const wmSnap = await firestore.collection("webmaster").doc(resolvedUid).get();
    const isWebmaster = Boolean(
      resolvedUid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
        userData?.role === "webmaster" ||
        (wmSnap.exists && wmSnap.data()?.active !== false)
    );

    if (portal === "webmaster" && !isWebmaster) {
      sendJson(res, { success: false, error: "This account is not authorized to access the Webmaster Portal." }, 403);
      return;
    }
    if (portal === "user" && isWebmaster) {
      sendJson(res, { success: false, error: "This is a Webmaster account. Please sign in from the Webmaster Login page." }, 403);
      return;
    }

    if (portal === "user" && !isWebmaster) {
      const siteSnap = await firestore.doc("settings/site").get();
      const siteData = siteSnap.exists ? siteSnap.data() : null;
      if (siteData && siteData.emailLoginEnabled === false) {
        sendJson(
          res,
          {
            success: false,
            error: "Mobile & Password login is currently disabled by the webmaster.",
            code: "AUTH_METHOD_DISABLED",
          },
          403
        );
        return;
      }
    }

    mobilePhoneIpRateLimitMap.delete(phoneRateKey);

    const customToken = await adminAuth.createCustomToken(resolvedUid, {
      accountUid: userData?.accountUid || resolvedUid,
      role: isWebmaster ? "webmaster" : "user",
    });

    // Privacy invariant: NEVER return email, uid, accountUid, or phone in response
    sendJson(res, {
      success: true,
      customToken,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    const code = Number(err?.code);
    const isTransient =
      code === 8 ||
      code === 14 ||
      code === 4 ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("DEADLINE_EXCEEDED");
    console.error("[Auth API] Mobile password login error:", msg || "unexpected");
    sendJson(
      res,
      {
        success: false,
        error: isTransient
          ? "Authentication service is temporarily busy. Please try again in a moment."
          : "Unable to process login request. Please try again.",
      },
      isTransient ? 503 : 500
    );
  }
}

export async function handleAuthDeleteAccount(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
    return;
  }

  const authHeader = String(req.headers.authorization || "");
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    sendJson(res, { success: false, error: "Authentication required." }, 401);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { success: false, error: "Account deletion service is temporarily unavailable." }, 503);
    return;
  }

  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);

  let decoded: { uid: string; email?: string };
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    sendJson(res, { success: false, error: "Invalid or expired authentication token." }, 401);
    return;
  }

  const uid = decoded.uid;

  try {
    const [wmSnap, userSnap] = await Promise.all([
      firestore.collection("webmaster").doc(uid).get(),
      firestore.collection("users").doc(uid).get(),
    ]);
    const userData = userSnap.exists ? userSnap.data() || {} : null;

    if (
      uid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
      userData?.role === "webmaster" ||
      (wmSnap.exists && wmSnap.data()?.active !== false)
    ) {
      sendJson(res, { success: false, error: "Security Protection: Webmaster accounts cannot be self-deleted." }, 403);
      return;
    }

    const email = String(userData?.email || decoded.email || "").trim().toLowerCase();
    const phone = String(userData?.phone || "").trim();
    const accountUid = userData?.accountUid || uid;

    const batch = firestore.batch();

    // 1. Anonymize groups submitted by user
    const groupsSnap = await firestore.collection("groups").where("submittedBy", "==", uid).get();
    for (const gDoc of groupsSnap.docs) {
      batch.update(gDoc.ref, {
        submittedBy: "deleted",
        submitterDeleted: true,
        submittedByName: "Deleted User",
        submittedByEmail: "",
        submittedByPhone: "",
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.delete(firestore.collection("groupOwnership").doc(gDoc.id));
    }

    // 2. Delete favorites & notifications
    const [favsSnap, notifSnap] = await Promise.all([
      firestore.collection("favorites").where("userId", "==", uid).get(),
      firestore.collection("notifications").where("userId", "==", uid).get(),
    ]);
    favsSnap.docs.forEach((d) => batch.delete(d.ref));
    notifSnap.docs.forEach((d) => batch.delete(d.ref));

    // 3. Registry & tombstone
    if (accountUid) {
      batch.set(
        firestore.collection("accountUidRegistry").doc(accountUid),
        {
          accountUid,
          firebaseUid: uid,
          status: "deleted",
          deletedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    batch.set(
      firestore.collection("deletedAccounts").doc(accountUid),
      {
        accountUid,
        status: "permanently_deleted",
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: uid,
        deletedByEmail: email,
        reason: "Self Direct Permanent Deletion",
        deletionType: "direct_user_delete",
        reRegistrationAllowed: true,
      },
      { merge: true }
    );

    // 4. Clean up identity indexes server-side
    if (email) {
      batch.delete(firestore.collection("emailIndex").doc(email));
    }
    if (phone) {
      const norm = normalizeIndianMobileNumber(phone);
      const keys = norm.valid ? norm.variations : [phone];
      for (const k of Array.from(new Set([phone, ...keys]))) {
        batch.delete(firestore.collection("mobileIndex").doc(k));
      }
    }

    batch.delete(firestore.collection("pendingRegistrations").doc(uid));
    batch.delete(firestore.collection("users").doc(uid));

    batch.set(firestore.collection("audit_logs").doc(), {
      action: "USER_SELF_DELETED",
      targetUid: uid,
      actorUid: uid,
      details: { accountUid },
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    });

    await batch.commit();

    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr: any) {
      console.warn("[Auth API] Self-delete Firebase Auth user cleanup notice:", authErr?.message);
    }

    sendJson(res, { success: true });
  } catch (err: any) {
    console.error("[Auth API] Self-delete error:", err?.message ?? "unexpected");
    sendJson(res, { success: false, error: "Failed to delete account. Please try again." }, 500);
  }
}

