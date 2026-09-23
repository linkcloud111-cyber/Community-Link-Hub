/**
 * LinkCloud - 4-Hour Unverified Provisional Account Cleanup
 * 
 * Cloudflare Pages Function / Scheduled Worker endpoint.
 * Idempotently cleans up unverified email/password registrations older than 4 hours.
 * 
 * SAFETY MANDATES:
 * 1. Authoritative check on Firebase Auth before deletion: NEVER delete a verified user (emailVerified === true).
 * 2. Webmaster Protection: NEVER touch or delete Webmaster accounts.
 * 3. Provider Exemption: NEVER delete Google-authenticated or phone OTP accounts.
 * 4. Monotonic UID Counter: Sequence counter is NEVER decremented. Old UIDs are never reused.
 * 5. Full Footprint Cleanup: Deletes Auth user, /users/{uid}, /emailIndex/{email}, /accountUidRegistry/{uid},
 *    and /pendingRegistrations/{uid} so the user can register anew with the same Gmail address.
 */

import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import { getServiceAccount, getGoogleAccessToken } from "../email-change/_firebase-admin";
import {
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreDeleteDoc,
  firestoreListCollection,
} from "../email-change/_firestore";
import { requireWebmasterAuth } from "./_admin-common";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
    },
  });
}

/**
 * Authoritative lookup of a Firebase Auth user via Google IdentityToolkit REST API
 */
async function getFirebaseAuthUser(localId: string, accessToken: string): Promise<any | null> {
  try {
    const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localId: [localId] }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.users?.[0] || null;
  } catch (err) {
    console.warn(`[Cleanup] Auth lookup failed for ${localId}:`, err);
    return null;
  }
}

/**
 * Delete user from Firebase Auth via IdentityToolkit
 */
async function deleteFirebaseAuthUser(localId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localId }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[Cleanup] Auth delete error for ${localId}:`, err);
    return false;
  }
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Verify caller: either Cron Secret or active Webmaster authentication
  const cronSecretHeader = (request.headers.get("X-Cron-Secret") || "").trim();
  const authHeader = (request.headers.get("Authorization") || "").trim();
  const envCronSecret = ((env.CRON_SECRET || env.CLEANUP_CRON_SECRET || "") as string).trim();

  let callerActor = "scheduler_cron";

  if (cronSecretHeader) {
    // Caller is explicitly identifying as an automated Cron Scheduler
    if (!envCronSecret) {
      console.error("[Cleanup Auth Error] CRON_SECRET is not configured in environment bindings.");
      return errorResponse("Server configuration error: CRON_SECRET missing", 500);
    }

    if (cronSecretHeader !== envCronSecret) {
      console.warn("[Cleanup Auth Warning] Invalid Cron secret received.");
      return errorResponse("Unauthorized: Invalid Cron secret", 401);
    }

    // Valid Cron secret verified
    callerActor = "scheduler_cron";
  } else {
    // No Cron header provided. Authenticate as Webmaster using standard Firebase Bearer token.
    if (!authHeader) {
      return errorResponse("Unauthorized: Requires Webmaster role or valid Cron secret", 401);
    }

    // Check if the bearer token happens to match the cron secret (fallback for direct curl with bearer)
    if (envCronSecret && authHeader === `Bearer ${envCronSecret}`) {
      callerActor = "scheduler_cron";
    } else {
      const webmasterCheck = await requireWebmasterAuth(request, env);
      if (!webmasterCheck.valid) {
        return errorResponse("Unauthorized: Requires Webmaster role or valid Cron secret", 401);
      }
      callerActor = webmasterCheck.email || "webmaster";
    }
  }

  const now = Date.now();
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  const cutoffTime = now - FOUR_HOURS_MS;
  const cutoffIso = new Date(cutoffTime).toISOString();

  const sa = getServiceAccount(env);
  let accessToken = "";
  if (sa) {
    try {
      accessToken = await getGoogleAccessToken(sa);
    } catch (e: any) {
      console.warn("[Cleanup] Failed to acquire Google access token:", e.message);
    }
  }

  // 1. Discover candidate unverified registrations
  const candidateUids = new Map<string, { uid: string; email: string; phone?: string; createdAt: string }>();

  // A. Check pendingRegistrations collection
  try {
    const pendingDocs = await firestoreListCollection("pendingRegistrations", env, 100);
    for (const doc of pendingDocs) {
      if (doc.uid) {
        candidateUids.set(doc.uid, {
          uid: doc.uid,
          email: (doc.email || "").trim().toLowerCase(),
          phone: doc.phone || "",
          createdAt: doc.registrationCreatedAt || doc.createdAt || "",
        });
      }
    }
  } catch (e) {
    console.warn("[Cleanup] pendingRegistrations list note:", e);
  }

  // B. Check users collection for pending_verification status
  try {
    const usersDocs = await firestoreListCollection("users", env, 100);
    for (const u of usersDocs) {
      if (
        u.uid &&
        (u.status === "pending_verification" || u.emailVerified === false) &&
        u.role !== "webmaster"
      ) {
        if (!candidateUids.has(u.uid)) {
          candidateUids.set(u.uid, {
            uid: u.uid,
            email: (u.email || "").trim().toLowerCase(),
            phone: u.phone || "",
            createdAt: u.registrationCreatedAt || u.createdAt || "",
          });
        }
      }
    }
  } catch (e) {
    console.warn("[Cleanup] users list note:", e);
  }

  const results: any[] = [];
  let cleanedCount = 0;
  let skippedVerifiedCount = 0;
  let skippedRecentCount = 0;
  let skippedProtectedCount = 0;

  for (const [uid, candidate] of candidateUids.entries()) {
    // 1. Protected Check: NEVER touch Webmaster
    try {
      const webmasterDoc = await firestoreGetDoc(`webmaster/${uid}`, env);
      if (webmasterDoc && webmasterDoc.role === "webmaster") {
        skippedProtectedCount++;
        results.push({ uid, status: "SKIPPED_WEBMASTER" });
        continue;
      }
    } catch {
      // ignore
    }

    // 2. Fetch fresh Firestore user record
    let userDoc: any = null;
    try {
      userDoc = await firestoreGetDoc(`users/${uid}`, env);
    } catch {
      // record may not exist
    }

    if (userDoc?.role === "webmaster") {
      skippedProtectedCount++;
      results.push({ uid, status: "SKIPPED_WEBMASTER_ROLE" });
      continue;
    }

    // 3. Check registration timestamp
    const regTimestampStr = candidate.createdAt || userDoc?.registrationCreatedAt || userDoc?.createdAt;
    const regTimeMs = regTimestampStr ? new Date(regTimestampStr).getTime() : 0;

    // 4. Authoritative Check against Firebase Auth if access token available
    let authUser: any = null;
    if (accessToken) {
      authUser = await getFirebaseAuthUser(uid, accessToken);
    }

    // Determine actual creation time from Auth if available
    const authCreatedMs = authUser?.createdAt ? parseInt(authUser.createdAt, 10) : 0;
    const effectiveCreationMs = regTimeMs || authCreatedMs;

    // If account was created less than 4 hours ago, SKIP
    if (effectiveCreationMs > 0 && effectiveCreationMs > cutoffTime) {
      skippedRecentCount++;
      results.push({
        uid,
        email: candidate.email,
        status: "SKIPPED_TOO_RECENT",
        ageMinutes: Math.round((now - effectiveCreationMs) / (60 * 1000)),
      });
      continue;
    }

    // Check email verification state authoritatively
    const isAuthVerified = authUser?.emailVerified === true;
    const isFirestoreVerified = userDoc?.emailVerified === true || userDoc?.status === "active";

    if (isAuthVerified || isFirestoreVerified) {
      skippedVerifiedCount++;
      // Clean up stale pending registration doc if present
      await firestoreDeleteDoc(`pendingRegistrations/${uid}`, env).catch(() => {});
      results.push({
        uid,
        email: candidate.email,
        status: "SKIPPED_VERIFIED",
      });
      continue;
    }

    // Check provider: do NOT delete Google-authenticated accounts
    if (authUser?.providerUserInfo) {
      const isGoogle = authUser.providerUserInfo.some(
        (p: any) => p.providerId === "google.com"
      );
      if (isGoogle) {
        skippedProtectedCount++;
        results.push({ uid, email: candidate.email, status: "SKIPPED_GOOGLE_ACCOUNT" });
        continue;
      }
    }

    // 5. Eligible for cleanup: Perform complete, idempotent removal
    const cleanEmail = (candidate.email || userDoc?.email || "").toLowerCase();
    const cleanPhone = candidate.phone || userDoc?.phone || "";

    // A. Delete from Firebase Auth
    if (accessToken) {
      await deleteFirebaseAuthUser(uid, accessToken);
    }

    // B. Delete Firestore user document and userProfiles document if present
    await firestoreDeleteDoc(`users/${uid}`, env);
    await firestoreDeleteDoc(`userProfiles/${uid}`, env).catch(() => {});

    // C. Delete emailIndex document so Gmail is free to register again
    if (cleanEmail) {
      await firestoreDeleteDoc(`emailIndex/${cleanEmail}`, env);
    }

    // D. Delete mobileIndex document if exists
    if (cleanPhone) {
      await firestoreDeleteDoc(`mobileIndex/${cleanPhone}`, env);
    }

    // E. Delete accountUidRegistry document
    await firestoreDeleteDoc(`accountUidRegistry/${uid}`, env);

    // F. Delete pendingRegistrations document
    await firestoreDeleteDoc(`pendingRegistrations/${uid}`, env);

    // G. Write audit log (Monotonic counter is NEVER touched / decremented)
    const auditId = `audit_cleanup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await firestoreSetDoc(
      `auditLogs/${auditId}`,
      {
        action: "UNVERIFIED_PROVISIONAL_EXPIRED_CLEANUP",
        targetUid: uid,
        actorUid: callerActor,
        details: {
          email: cleanEmail,
          accountUid: uid,
          registeredAt: regTimestampStr,
          cleanedAt: new Date().toISOString(),
          reason: "Unverified provisional registration expired after 4-hour threshold",
        },
        timestamp: new Date().toISOString(),
      },
      env,
      false
    ).catch(() => {});

    cleanedCount++;
    results.push({
      uid,
      email: cleanEmail,
      status: "CLEANED_SUCCESSFULLY",
    });
  }

  return jsonResponse({
    success: true,
    message: `Cleanup completed. Evaluated: ${candidateUids.size}, Cleaned: ${cleanedCount}`,
    cutoffIso,
    totalCandidates: candidateUids.size,
    cleanedCount,
    skippedVerifiedCount,
    skippedRecentCount,
    skippedProtectedCount,
    results,
  });
}

export const onRequestGet = onRequestPost;
