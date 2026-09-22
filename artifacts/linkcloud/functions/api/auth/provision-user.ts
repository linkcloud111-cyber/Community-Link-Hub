import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import {
  getServiceAccount,
  getGoogleAccessToken,
  adminCreateCustomToken,
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

  const { fullName, dob, email, phone, password } = body;

  const cleanName = typeof fullName === "string" ? fullName.trim() : "";
  if (cleanName.length < 3) {
    return errorResponse("Full Name must contain at least 3 letters.", 400);
  }

  if (!dob || typeof dob !== "string") {
    return errorResponse("Date of Birth is required.", 400);
  }
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (isNaN(age) || age < 18) {
    return errorResponse("You must be at least 18 years old.", 400);
  }

  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!cleanEmail.endsWith("@gmail.com") || !/^[a-zA-Z0-9.]+@gmail\.com$/.test(cleanEmail)) {
    return errorResponse("Only valid personal Gmail addresses (@gmail.com) are allowed.", 400);
  }

  let cleanPhone = typeof phone === "string" ? phone.replace(/[\s\-\(\)]/g, "") : "";
  if (!cleanPhone.startsWith("+91")) {
    if (cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone)) {
      cleanPhone = `+91${cleanPhone}`;
    } else {
      return errorResponse("Enter a valid 10-digit Indian mobile number.", 400);
    }
  }
  if (!/^\+91[6-9]\d{9}$/.test(cleanPhone)) {
    return errorResponse("Enter a valid Indian mobile number starting with 6, 7, 8, or 9.", 400);
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return errorResponse("Password must be at least 8 characters long.", 400);
  }

  // 1. Check duplicates
  const existingEmail = await firestoreGetDoc(`emailIndex/${cleanEmail}`, env);
  if (existingEmail) {
    return errorResponse("This Gmail address is already registered.", 409);
  }

  const existingPhone = await firestoreGetDoc(`mobileIndex/${cleanPhone}`, env);
  if (existingPhone) {
    return errorResponse("An account with this Mobile Number is already registered.", 409);
  }

  // 2. Allocate sequential UID
  const sequenceDoc = await firestoreGetDoc("counters/userSequence", env);
  let currentNumber = typeof sequenceDoc?.currentNumber === "number" ? sequenceDoc.currentNumber : 100;
  const prefix = sequenceDoc?.prefix || "linkcloud";

  let nextNumber = currentNumber + 1;
  let candidateUid = `${prefix}${nextNumber}`;

  let existingRegistry = await firestoreGetDoc(`accountUidRegistry/${candidateUid}`, env);
  while (existingRegistry) {
    nextNumber++;
    candidateUid = `${prefix}${nextNumber}`;
    existingRegistry = await firestoreGetDoc(`accountUidRegistry/${candidateUid}`, env);
  }

  const nowIso = new Date().toISOString();

  // Update sequence counter
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

  // Reserve in registry
  await firestoreSetDoc(
    `accountUidRegistry/${candidateUid}`,
    {
      accountUid: candidateUid,
      firebaseUid: candidateUid,
      status: "active",
      activatedAt: nowIso,
    },
    env,
    false
  );

  // 3. Create Firebase Auth user with exact UID
  const sa = getServiceAccount(env);
  if (sa) {
    try {
      const accessToken = await getGoogleAccessToken(sa);
      const authRes = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          localId: candidateUid,
          email: cleanEmail,
          password,
          displayName: cleanName,
        }),
      });

      if (!authRes.ok) {
        const errText = await authRes.text();
        console.warn("[Cloudflare Auth] IdentityToolkit signUp notice:", errText);
      }
    } catch (authErr: any) {
      console.warn("[Cloudflare Auth] Auth creation notice:", authErr.message);
    }
  }

  // 4. Create Firestore user document and indexes
  await firestoreSetDoc(
    `users/${candidateUid}`,
    {
      uid: candidateUid,
      accountUid: candidateUid,
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
    },
    env,
    false
  );

  await firestoreSetDoc(
    `pendingRegistrations/${candidateUid}`,
    {
      uid: candidateUid,
      email: cleanEmail,
      phone: cleanPhone,
      registrationCreatedAt: nowIso,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      status: "pending_verification",
    },
    env,
    false
  );

  await firestoreSetDoc(
    `emailIndex/${cleanEmail}`,
    {
      uid: candidateUid,
      email: cleanEmail,
      createdAt: nowIso,
    },
    env,
    false
  );

  await firestoreSetDoc(
    `mobileIndex/${cleanPhone}`,
    {
      uid: candidateUid,
      phone: cleanPhone,
      createdAt: nowIso,
    },
    env,
    false
  );

  // 5. Audit log
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await firestoreSetDoc(
    `auditLogs/${auditId}`,
    {
      action: "USER_PROVISIONED",
      targetUid: candidateUid,
      actorUid: "system",
      details: { email: cleanEmail, phone: cleanPhone, accountUid: candidateUid },
      timestamp: nowIso,
    },
    env,
    false
  );

  // 6. Create custom token
  let customToken = "";
  if (sa) {
    try {
      customToken = await adminCreateCustomToken(env, candidateUid, {
        accountUid: candidateUid,
        role: "user",
      });
    } catch (tokenErr: any) {
      console.warn("[Cloudflare Auth] Custom token creation notice:", tokenErr.message);
    }
  }

  return jsonResponse({
    success: true,
    uid: candidateUid,
    accountUid: candidateUid,
    customToken,
    message: "User successfully provisioned with canonical UID.",
  });
}
