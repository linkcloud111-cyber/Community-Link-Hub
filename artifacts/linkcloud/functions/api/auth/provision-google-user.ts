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
    return errorResponse(err?.message || "Failed to verify ID token", 401);
  }

  const googleEmail = (decoded.email || "").trim().toLowerCase();
  const googleName = decoded.displayName || decoded.name || "Google User";
  const googlePicture = decoded.photoURL || decoded.picture || "";

  if (!googleEmail) {
    return errorResponse("Google account does not have a verified email.", 400);
  }

  // Check existing user in emailIndex
  const existingIndex = await firestoreGetDoc(`emailIndex/${googleEmail}`, env);
  if (existingIndex && existingIndex.uid) {
    const customToken = await adminCreateCustomToken(env, existingIndex.uid);
    return jsonResponse({
      success: true,
      uid: existingIndex.uid,
      customToken,
      isNew: false,
    });
  }

  // Allocate sequential UID
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
          email: googleEmail,
          displayName: googleName,
          photoUrl: googlePicture,
        }),
      });
    } catch (e: any) {
      console.warn("[Cloudflare Auth] Google signUp notice:", e.message);
    }
  }

  // Create /users/{candidateUid}
  await firestoreSetDoc(
    `users/${candidateUid}`,
    {
      uid: candidateUid,
      accountUid: candidateUid,
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
    },
    env,
    false
  );

  await firestoreSetDoc(
    `emailIndex/${googleEmail}`,
    {
      uid: candidateUid,
      email: googleEmail,
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
}
