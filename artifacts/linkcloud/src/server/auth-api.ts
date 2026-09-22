import type { IncomingMessage, ServerResponse } from "http";
import { getFirebaseAdminApp } from "./admin-api";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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
    // 2. Duplicate checks in Firestore indexes
    const emailIndexRef = firestore.collection("emailIndex").doc(cleanEmail);
    const emailIndexSnap = await emailIndexRef.get();
    if (emailIndexSnap.exists) {
      sendJson(res, { error: "This Gmail address is already registered." }, 409);
      return;
    }

    const mobileIndexRef = firestore.collection("mobileIndex").doc(cleanPhone);
    const mobileIndexSnap = await mobileIndexRef.get();
    if (mobileIndexSnap.exists) {
      sendJson(res, { error: "An account with this Mobile Number is already registered." }, 409);
      return;
    }

    // Check Firebase Auth duplicate
    try {
      const existingUser = await auth.getUserByEmail(cleanEmail);
      if (existingUser) {
        sendJson(res, { error: "This Gmail address is already registered." }, 409);
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
      createdAt: nowIso,
      updatedAt: nowIso,
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

    // /auditLogs/{logId}
    const auditLogRef = firestore.collection("auditLogs").doc();
    batch.set(auditLogRef, {
      action: "USER_PROVISIONED",
      targetUid: canonicalUid,
      actorUid: "system",
      details: {
        email: cleanEmail,
        phone: cleanPhone,
        accountUid: canonicalUid,
      },
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
        error: err?.message || "Failed to provision user.",
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
        const customToken = await auth.createCustomToken(existingUid);
        sendJson(res, {
          success: true,
          uid: existingUid,
          customToken,
          isNew: false,
        });
        return;
      }
    }

    // Allocate canonical sequential UID
    const canonicalUid = await allocateNextSequentialUid();
    const nowIso = new Date().toISOString();

    // Clean up temporary popup user if different from canonical UID first,
    // so that the email is released and can be bound to the canonical UID in Firebase Auth
    if (decoded.uid && decoded.uid !== canonicalUid) {
      try {
        await auth.deleteUser(decoded.uid);
      } catch (delErr: any) {
        console.warn("[Auth API] Temporary popup user cleanup note:", delErr.message);
      }
    }

    // Create user in Firebase Auth with canonical UID
    try {
      await auth.createUser({
        uid: canonicalUid,
        email: googleEmail,
        displayName: googleName,
        photoURL: googlePicture,
        emailVerified: true,
        disabled: false,
      });
    } catch (createErr: any) {
      console.warn("[Auth API] Google createUser note:", createErr.message);
    }

    const batch = firestore.batch();

    // Create /users/{canonicalUid}
    const userDocRef = firestore.collection("users").doc(canonicalUid);
    batch.set(userDocRef, {
      uid: canonicalUid,
      accountUid: canonicalUid,
      displayName: googleName,
      email: googleEmail,
      phone: "",
      photoURL: googlePicture,
      emailVerified: true,
      phoneVerified: false,
      role: "user",
      status: "active",
      groupCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // /emailIndex/{email}
    batch.set(emailIndexRef, {
      uid: canonicalUid,
      email: googleEmail,
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
    const auditLogRef = firestore.collection("auditLogs").doc();
    batch.set(auditLogRef, {
      action: "USER_PROVISIONED_GOOGLE",
      targetUid: canonicalUid,
      actorUid: "system",
      details: { email: googleEmail },
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
    console.error("[Auth API] Google provision error:", err);
    sendJson(res, { success: false, error: err?.message || "Failed to provision Google account." }, 500);
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

    // Check if phone exists in mobileIndex
    const mobileIndexRef = firestore.collection("mobileIndex").doc(phoneNumber);
    const mobileIndexSnap = await mobileIndexRef.get();

    if (mobileIndexSnap.exists) {
      const existingUid = mobileIndexSnap.data()?.uid;
      if (existingUid) {
        const customToken = await auth.createCustomToken(existingUid);
        sendJson(res, {
          success: true,
          uid: existingUid,
          accountUid: existingUid,
          customToken,
          isNew: false,
        });
        return;
      }
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
    const auditLogRef = firestore.collection("auditLogs").doc();
    batch.set(auditLogRef, {
      action: "USER_PROVISIONED_PHONE",
      targetUid: canonicalUid,
      actorUid: "system",
      details: { phone: phoneNumber },
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
    sendJson(res, { success: false, error: err?.message || "Failed to provision phone account." }, 500);
  }
}

