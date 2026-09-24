import type { IncomingMessage, ServerResponse } from "http";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }

  try {
    const projectId =
      process.env.VITE_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      "linkcloud-5bb2f";

    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const sa = typeof process.env.FIREBASE_SERVICE_ACCOUNT_KEY === "string"
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
          : process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        credential = cert(sa);
      } catch (saErr) {
        console.warn("[Firebase Admin SDK] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:", saErr);
      }
    }

    adminApp = initializeApp({
      projectId,
      ...(credential ? { credential } : {}),
    });
    return adminApp;
  } catch (err) {
    console.warn("[Firebase Admin SDK] Initialization notice:", err);
    return null;
  }
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
 * Verifies that the incoming request has a valid Firebase ID Token
 * and that the token belongs to an authorized Webmaster.
 */
export async function verifyWebmasterToken(
  req: IncomingMessage
): Promise<{
  valid: boolean;
  uid?: string;
  email?: string;
  error?: string;
  statusCode?: number;
}> {
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: "Authentication required: Missing Bearer token.",
      statusCode: 401,
    };
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) {
    return {
      valid: false,
      error: "Authentication required: Empty Bearer token.",
      statusCode: 401,
    };
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    return {
      valid: false,
      error: "Server authentication service unavailable.",
      statusCode: 503,
    };
  }

  try {
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";

    // Verify Webmaster role in Firestore
    const firestore = getFirestore(app);

    // 1. Check /webmaster/{uid}
    const webmasterDoc = await firestore.collection("webmaster").doc(uid).get();
    if (webmasterDoc.exists) {
      const data = webmasterDoc.data() || {};
      if (data.active !== false && (data.role === "webmaster" || !data.role)) {
        return { valid: true, uid, email };
      }
    }

    // 2. Check /users/{uid}
    const userDoc = await firestore.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data() || {};
      if (data.role === "webmaster" && data.status === "active") {
        return { valid: true, uid, email };
      }
    }

    return {
      valid: false,
      error: "Forbidden: Webmaster authority required.",
      statusCode: 403,
    };
  } catch (err: any) {
    console.warn("[Admin API] Token verification failed:", err?.message || err);
    return {
      valid: false,
      error: "Invalid or expired authentication token.",
      statusCode: 401,
    };
  }
}

export async function handleAdminUserStatusRequest(
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

  // 1. Verify Webmaster authorization
  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }

  const callerUid = authResult.uid!;
  const callerEmail = authResult.email || "webmaster@linkcloud.in";

  const data = await parseBody(req);
  const { uid: targetUid, status } = data;

  if (!targetUid || typeof targetUid !== "string") {
    sendJson(res, { error: "Missing or invalid 'uid' parameter." }, 400);
    return;
  }

  // 2. Enforce Self-Protection
  if (
    targetUid === callerUid &&
    (status === "suspended" || status === "banned" || status === "deleted")
  ) {
    sendJson(
      res,
      { error: "Self-Protection: You cannot suspend, ban, or deactivate your active Webmaster account." },
      403
    );
    return;
  }

  const app = getFirebaseAdminApp()!;
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  try {
    // Check if target user is also a webmaster
    const targetWebmasterDoc = await firestore.collection("webmaster").doc(targetUid).get();
    const targetUserDoc = await firestore.collection("users").doc(targetUid).get();
    const isTargetWebmaster = Boolean(
      (targetWebmasterDoc.exists && (targetWebmasterDoc.data()?.role === "webmaster" || targetWebmasterDoc.data()?.active === true)) ||
      (targetUserDoc.exists && targetUserDoc.data()?.role === "webmaster")
    );

    if (isTargetWebmaster) {
      // Last-Webmaster safeguard check
      const webmastersSnap = await firestore.collection("webmaster").get();
      const activeCount = webmastersSnap.docs.filter((d) => {
        const data = d.data();
        return data.active !== false && (data.role === "webmaster" || !data.role);
      }).length;

      if (activeCount <= 1) {
        sendJson(
          res,
          { error: "Forbidden: Cannot deactivate or alter the status of the last remaining active Webmaster account in the system." },
          403
        );
        return;
      }

      sendJson(
        res,
        { error: "Security Protection: You cannot alter the status of a protected Webmaster account." },
        403
      );
      return;
    }

    const shouldDisable = status === "suspended" || status === "banned";
    let authUpdated = false;

    try {
      await auth.updateUser(targetUid, { disabled: shouldDisable });
      if (shouldDisable) {
        await auth.revokeRefreshTokens(targetUid);
      }
      authUpdated = true;
    } catch (authErr: any) {
      console.warn(`[Admin API] Auth update notice for ${targetUid}:`, authErr.message);
    }

    // Update Firestore user document
    const nowIso = new Date().toISOString();
    const userRef = firestore.collection("users").doc(targetUid);
    await userRef.set(
      {
        status,
        updatedAt: nowIso,
        statusUpdatedBy: callerEmail,
        statusUpdatedAt: nowIso,
      },
      { merge: true }
    );

    // Write audit log
    await firestore.collection("auditLogs").add({
      action: shouldDisable ? "USER_SUSPENDED" : "USER_STATUS_UPDATED",
      targetUid,
      actorUid: callerUid,
      details: { newStatus: status, disabled: shouldDisable, actorEmail: callerEmail },
      timestamp: nowIso,
    });

    console.log("[Admin API] Updated user status successfully:", {
      targetUid,
      newStatus: status,
      callerUid,
    });

    sendJson(res, {
      success: true,
      uid: targetUid,
      status,
      disabled: shouldDisable,
      authUpdated,
      timestamp: nowIso,
    });
  } catch (err: any) {
    console.error("[Admin API] Failed to update user status:", err);
    sendJson(res, { error: err?.message || "Failed to update user status." }, 500);
  }
}

export async function handleAdminUserDeleteRequest(
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

  // 1. Verify Webmaster authorization
  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }

  const callerUid = authResult.uid!;
  const callerEmail = authResult.email || "webmaster@linkcloud.in";

  const data = await parseBody(req);
  const { uid: targetUid, reason } = data;

  if (!targetUid || typeof targetUid !== "string") {
    sendJson(res, { error: "Missing or invalid 'uid' parameter." }, 400);
    return;
  }

  // 2. Self-Protection check
  if (targetUid === callerUid) {
    sendJson(
      res,
      { error: "Self-Protection: You cannot delete your active Webmaster account." },
      403
    );
    return;
  }

  const app = getFirebaseAdminApp()!;
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  try {
    // Check if target is a webmaster
    const targetWebmasterDoc = await firestore.collection("webmaster").doc(targetUid).get();
    const targetUserDoc = await firestore.collection("users").doc(targetUid).get();
    const isTargetWebmaster = Boolean(
      (targetWebmasterDoc.exists && (targetWebmasterDoc.data()?.role === "webmaster" || targetWebmasterDoc.data()?.active === true)) ||
      (targetUserDoc.exists && targetUserDoc.data()?.role === "webmaster")
    );

    if (isTargetWebmaster) {
      // Last-Webmaster safeguard check
      const webmastersSnap = await firestore.collection("webmaster").get();
      const activeCount = webmastersSnap.docs.filter((d) => {
        const data = d.data();
        return data.active !== false && (data.role === "webmaster" || !data.role);
      }).length;

      if (activeCount <= 1) {
        sendJson(
          res,
          { error: "Forbidden: Cannot delete the last remaining active Webmaster account in the system." },
          403
        );
        return;
      }

      sendJson(
        res,
        { error: "Security Protection: Webmaster accounts cannot be deleted through the user management API." },
        403
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const userDocRef = firestore.collection("users").doc(targetUid);
    const userSnap = await userDocRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const targetEmail = userData.email || "";
    const targetPhone = userData.phone || "";
    const targetAccountUid = userData.accountUid || targetUid;

    // Delete from Firebase Auth
    let authDeleted = false;
    try {
      await auth.deleteUser(targetUid);
      authDeleted = true;
    } catch (authErr: any) {
      console.warn(`[Admin API] Auth delete notice for ${targetUid}:`, authErr.message);
    }

    // Write tombstone to /deletedAccounts
    await firestore.collection("deletedAccounts").doc(targetUid).set({
      uid: targetUid,
      accountUid: targetAccountUid,
      email: targetEmail,
      phone: targetPhone,
      deletedAt: nowIso,
      deletedBy: callerEmail,
      deletedByUid: callerUid,
      reason: reason || "Webmaster administrative deletion",
    });

    // Clean indexes and remove user document
    const batch = firestore.batch();
    if (targetEmail) {
      batch.delete(firestore.collection("emailIndex").doc(targetEmail.toLowerCase()));
    }
    if (targetPhone) {
      batch.delete(firestore.collection("mobileIndex").doc(targetPhone));
    }
    batch.delete(userDocRef);

    // Audit log
    const auditLogRef = firestore.collection("auditLogs").doc();
    batch.set(auditLogRef, {
      action: "USER_DELETED_ADMIN",
      targetUid,
      actorUid: callerUid,
      details: {
        targetAccountUid,
        targetEmail,
        actorEmail: callerEmail,
        reason: reason || "Webmaster administrative deletion",
      },
      timestamp: nowIso,
    });

    await batch.commit();

    console.log("[Admin API] Permanently deleted user:", { targetUid, callerUid });

    sendJson(res, {
      success: true,
      uid: targetUid,
      authDeleted,
      timestamp: nowIso,
    });
  } catch (err: any) {
    console.error("[Admin API] Failed to delete user:", err);
    sendJson(res, { error: err?.message || "Failed to delete user." }, 500);
  }
}

export async function handleAdminStatsRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, { error: "Method not allowed. Use GET." }, 405);
    return;
  }

  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }

  const app = getFirebaseAdminApp()!;
  const firestore = getFirestore(app);

  try {
    const [usersSnap, groupsSnap, reportsSnap, complaintsSnap, counterSnap] = await Promise.all([
      firestore.collection("users").count().get(),
      firestore.collection("groups").count().get(),
      firestore.collection("reports").count().get(),
      firestore.collection("complaints").count().get(),
      firestore.collection("counters").doc("userSequence").get(),
    ]);

    const userSequence = counterSnap.exists ? counterSnap.data() : { currentNumber: 100, prefix: "linkcloud" };

    sendJson(res, {
      success: true,
      stats: {
        totalUsers: usersSnap.data().count,
        totalGroups: groupsSnap.data().count,
        totalReports: reportsSnap.data().count,
        totalComplaints: complaintsSnap.data().count,
        userSequence,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Admin API] Failed to fetch stats:", err);
    sendJson(res, { error: err?.message || "Failed to fetch stats." }, 500);
  }
}

/**
 * Migration Dry-Run Endpoint: Scans Firestore, detects legacy UIDs, orphaned records,
 * and inconsistencies WITHOUT modifying any production data.
 */
export async function handleAdminMigrationDryRunRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, { error: "Method not allowed. Use GET." }, 405);
    return;
  }

  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }

  const app = getFirebaseAdminApp()!;
  const firestore = getFirestore(app);

  try {
    const usersSnap = await firestore.collection("users").get();
    const groupsSnap = await firestore.collection("groups").get();
    const counterSnap = await firestore.collection("counters").doc("userSequence").get();
    const emailIndexSnap = await firestore.collection("emailIndex").get();
    const mobileIndexSnap = await firestore.collection("mobileIndex").get();
    const registrySnap = await firestore.collection("accountUidRegistry").get();

    const userIds = new Set<string>();
    const legacyUids: string[] = [];
    const canonicalUids: string[] = [];
    const duplicateEmails = new Map<string, number>();
    const duplicatePhones = new Map<string, number>();

    const usersWithoutIndex: string[] = [];
    const indexedEmails = new Set<string>();
    const indexedPhones = new Set<string>();

    emailIndexSnap.forEach((doc) => indexedEmails.add(doc.id.toLowerCase()));
    mobileIndexSnap.forEach((doc) => indexedPhones.add(doc.id));

    usersSnap.forEach((doc) => {
      const data = doc.data();
      const uid = doc.id;
      userIds.add(uid);

      if (/^linkcloud\d+$/.test(uid)) {
        canonicalUids.push(uid);
      } else {
        legacyUids.push(uid);
      }

      if (data.email) {
        const e = data.email.toLowerCase();
        duplicateEmails.set(e, (duplicateEmails.get(e) || 0) + 1);
        if (!indexedEmails.has(e)) {
          usersWithoutIndex.push(uid);
        }
      }

      if (data.phone) {
        duplicatePhones.set(data.phone, (duplicatePhones.get(data.phone) || 0) + 1);
      }
    });

    // Check orphan groups
    const orphanedGroups: string[] = [];
    groupsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.submittedBy && !userIds.has(data.submittedBy)) {
        orphanedGroups.push(doc.id);
      }
    });

    const sequenceData = counterSnap.exists
      ? counterSnap.data()
      : { currentNumber: 100, prefix: "linkcloud" };

    const report = {
      dryRun: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalUsers: usersSnap.size,
        totalGroups: groupsSnap.size,
        canonicalUidCount: canonicalUids.length,
        legacyUidCount: legacyUids.length,
        indexedEmailCount: emailIndexSnap.size,
        indexedPhoneCount: mobileIndexSnap.size,
        registryCount: registrySnap.size,
        orphanedGroupCount: orphanedGroups.length,
        unindexedUserCount: usersWithoutIndex.length,
      },
      sequence: sequenceData,
      legacyUids: legacyUids.slice(0, 50),
      orphanedGroupSample: orphanedGroups.slice(0, 20),
      unindexedUserSample: usersWithoutIndex.slice(0, 20),
      status: "READY_FOR_SEQUENTIAL_PROVISIONING",
    };

    sendJson(res, { success: true, report });
  } catch (err: any) {
    console.error("[Admin API] Dry-run error:", err);
    sendJson(res, { error: err?.message || "Failed to perform migration dry-run." }, 500);
  }
}

export async function handleAdminCleanupUnverifiedRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
    });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed" }, 405);
    return;
  }

  try {
    const authHeader = (req.headers.authorization || "").trim();
    const cronSecretHeader = (
      (Array.isArray(req.headers["x-cron-secret"])
        ? req.headers["x-cron-secret"][0]
        : req.headers["x-cron-secret"]) || ""
    ).trim();
    const envCronSecret = (process.env.CRON_SECRET || process.env.CLEANUP_CRON_SECRET || "").trim();

    let callerActor = "scheduler_cron";

    if (cronSecretHeader) {
      if (!envCronSecret) {
        sendJson(res, { error: "Server configuration error: CRON_SECRET missing" }, 500);
        return;
      }

      if (cronSecretHeader !== envCronSecret) {
        sendJson(res, { error: "Unauthorized: Invalid Cron secret" }, 401);
        return;
      }

      callerActor = "scheduler_cron";
    } else {
      if (!authHeader) {
        sendJson(res, { error: "Unauthorized: Requires Webmaster role or valid Cron secret" }, 401);
        return;
      }

      if (envCronSecret && authHeader === `Bearer ${envCronSecret}`) {
        callerActor = "scheduler_cron";
      } else {
        const auth = await authenticateAdminRequest(req);
        if (!auth.authenticated) {
          sendJson(res, { error: auth.error || "Webmaster authentication required" }, 403);
          return;
        }
        callerActor = auth.user?.email || "webmaster";
      }
    }

    const app = getFirebaseAdminApp()!;
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    const now = Date.now();
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const cutoffTime = now - FOUR_HOURS_MS;
    const cutoffIso = new Date(cutoffTime).toISOString();

    const candidateUids = new Map<string, { uid: string; email: string; phone?: string; createdAt: string }>();

    // 1. Check pendingRegistrations
    try {
      const pendingSnap = await firestore.collection("pendingRegistrations").get();
      pendingSnap.forEach((doc) => {
        const d = doc.data();
        candidateUids.set(doc.id, {
          uid: doc.id,
          email: (d.email || "").trim().toLowerCase(),
          phone: d.phone || "",
          createdAt: d.registrationCreatedAt || d.createdAt || "",
        });
      });
    } catch (e) {
      console.warn("[Admin API] pendingRegistrations read note:", e);
    }

    // 2. Check users collection
    try {
      const usersSnap = await firestore.collection("users").where("status", "==", "pending_verification").get();
      usersSnap.forEach((doc) => {
        if (!candidateUids.has(doc.id)) {
          const d = doc.data();
          if (d.role !== "webmaster") {
            candidateUids.set(doc.id, {
              uid: doc.id,
              email: (d.email || "").trim().toLowerCase(),
              phone: d.phone || "",
              createdAt: d.registrationCreatedAt || d.createdAt || "",
            });
          }
        }
      });
    } catch (e) {
      console.warn("[Admin API] users query note:", e);
    }

    let cleanedCount = 0;
    let skippedVerifiedCount = 0;
    let skippedRecentCount = 0;
    let skippedProtectedCount = 0;
    const results: any[] = [];

    for (const [uid, candidate] of candidateUids.entries()) {
      // Protected Check: NEVER touch Webmaster
      const webmasterDoc = await firestore.collection("webmaster").doc(uid).get();
      if (webmasterDoc.exists && webmasterDoc.data()?.role === "webmaster") {
        skippedProtectedCount++;
        results.push({ uid, status: "SKIPPED_WEBMASTER" });
        continue;
      }

      const userDocSnap = await firestore.collection("users").doc(uid).get();
      const userData = userDocSnap.data();
      if (userData?.role === "webmaster") {
        skippedProtectedCount++;
        results.push({ uid, status: "SKIPPED_WEBMASTER_ROLE" });
        continue;
      }

      // Check registration timestamp
      const regTimestampStr = candidate.createdAt || userData?.registrationCreatedAt || userData?.createdAt;
      const regTimeMs = regTimestampStr ? new Date(regTimestampStr).getTime() : 0;

      // Authoritative Firebase Auth check
      let authUser: any = null;
      try {
        authUser = await auth.getUser(uid);
      } catch {
        // user may not exist in auth
      }

      const authCreatedMs = authUser?.metadata?.creationTime
        ? new Date(authUser.metadata.creationTime).getTime()
        : 0;
      const effectiveCreationMs = regTimeMs || authCreatedMs;

      // Younger than 4 hours -> SKIP
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

      // If verified in either Auth or Firestore -> SKIP
      if (authUser?.emailVerified === true || userData?.emailVerified === true || userData?.status === "active") {
        skippedVerifiedCount++;
        await firestore.collection("pendingRegistrations").doc(uid).delete().catch(() => {});
        results.push({ uid, email: candidate.email, status: "SKIPPED_VERIFIED" });
        continue;
      }

      // If Google provider -> SKIP
      if (authUser?.providerData?.some((p: any) => p.providerId === "google.com")) {
        skippedProtectedCount++;
        results.push({ uid, email: candidate.email, status: "SKIPPED_GOOGLE_ACCOUNT" });
        continue;
      }

      // Confirmed eligible for complete cleanup
      const cleanEmail = (candidate.email || userData?.email || "").toLowerCase();
      const cleanPhone = candidate.phone || userData?.phone || "";

      // 1. Delete from Auth
      if (authUser) {
        await auth.deleteUser(uid).catch((err: any) => {
          console.warn(`[Admin API] Auth delete notice for ${uid}:`, err.message);
        });
      }

      // 2. Batch delete Firestore records
      const batch = firestore.batch();
      batch.delete(firestore.collection("users").doc(uid));
      batch.delete(firestore.collection("userProfiles").doc(uid));
      if (cleanEmail) {
        batch.delete(firestore.collection("emailIndex").doc(cleanEmail));
      }
      if (cleanPhone) {
        batch.delete(firestore.collection("mobileIndex").doc(cleanPhone));
      }
      batch.delete(firestore.collection("accountUidRegistry").doc(uid));
      batch.delete(firestore.collection("pendingRegistrations").doc(uid));

      // Monotonic UID counter is NOT decremented
      const auditRef = firestore.collection("auditLogs").doc();
      batch.set(auditRef, {
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
      });

      await batch.commit();

      cleanedCount++;
      results.push({ uid, email: cleanEmail, status: "CLEANED_SUCCESSFULLY" });
    }

    sendJson(res, {
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
  } catch (err: any) {
    console.error("[Admin API] Cleanup error:", err);
    sendJson(res, { error: err?.message || "Failed to execute cleanup." }, 500);
  }
}

/**
 * GET /api/admin/settings
 * Retrieves public or administrative site settings
 */
export async function handleAdminSettingsGetRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, { error: "Method not allowed. Use GET." }, 405);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firestore service unavailable." }, 503);
    return;
  }

  try {
    const firestore = getFirestore(app);
    const snap = await firestore.collection("settings").doc("site").get();
    if (!snap.exists) {
      sendJson(res, { success: true, settings: null });
      return;
    }
    sendJson(res, { success: true, settings: snap.data() });
  } catch (err: any) {
    console.warn("[Admin API] Settings fetch error:", err?.message || err);
    sendJson(res, { error: "Failed to retrieve settings." }, 500);
  }
}

/**
 * POST /api/admin/settings
 * Updates site settings with strict validation, Webmaster authentication, and audit logging
 */
export async function handleAdminSettingsUpdateRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST" && req.method !== "PUT") {
    sendJson(res, { error: "Method not allowed. Use POST or PUT." }, 405);
    return;
  }

  // 1. Verify Webmaster authorization
  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }

  // 2. Parse body
  const body = await parseBody(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(res, { error: "Malformed payload: Expected JSON object." }, 400);
    return;
  }

  // 3. Prevent Privilege Escalation & Unauthorized field injection
  const forbiddenKeys = [
    "role",
    "roles",
    "uid",
    "accountUid",
    "isAdmin",
    "isWebmaster",
    "permissions",
    "password",
    "salt",
    "token",
  ];
  for (const key of forbiddenKeys) {
    if (key in body) {
      delete body[key];
    }
  }

  // 4. Validate Structured Data (JSON-LD) if present
  if (typeof body.structuredDataJson === "string" && body.structuredDataJson.trim().length > 0) {
    try {
      JSON.parse(body.structuredDataJson);
    } catch (parseErr: any) {
      sendJson(
        res,
        {
          error: `Invalid JSON syntax in structuredDataJson: ${parseErr.message}`,
        },
        400
      );
      return;
    }
  }

  // 5. Sanitize & Validate URLs to prevent script injection (javascript: or data: schemes)
  const urlFields = [
    "canonicalUrl",
    "ogImage",
    "twitterCardImage",
    "siteLogo",
    "favicon",
    "homepageBanner",
    "footerLogo",
    "googleMapUrl",
    "facebookUrl",
    "instagramUrl",
    "telegramUrl",
    "whatsappUrl",
    "youtubeUrl",
    "linkedinUrl",
    "twitterUrl",
    "redditUrl",
    "githubUrl",
  ];

  for (const field of urlFields) {
    if (typeof body[field] === "string" && body[field].trim().length > 0) {
      const val = body[field].trim().toLowerCase();
      if (val.startsWith("javascript:") || val.startsWith("data:") || val.startsWith("vbscript:")) {
        sendJson(res, { error: `Disallowed URL protocol in field '${field}'.` }, 400);
        return;
      }
    }
  }

  // 6. Validate Canonical URL format
  if (typeof body.canonicalUrl === "string" && body.canonicalUrl.trim().length > 0) {
    const trimmedCanonical = body.canonicalUrl.trim();
    if (!trimmedCanonical.startsWith("http://") && !trimmedCanonical.startsWith("https://")) {
      sendJson(res, { error: "Canonical URL must start with http:// or https://" }, 400);
      return;
    }
  }

  // 7. Enforce string length bounds
  if (typeof body.metaTitle === "string" && body.metaTitle.length > 200) {
    sendJson(res, { error: "Meta Title cannot exceed 200 characters." }, 400);
    return;
  }
  if (typeof body.metaDescription === "string" && body.metaDescription.length > 500) {
    sendJson(res, { error: "Meta Description cannot exceed 500 characters." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firestore service unavailable." }, 503);
    return;
  }

  try {
    const firestore = getFirestore(app);
    const nowIso = new Date().toISOString();

    const updatePayload = {
      ...body,
      updatedAt: nowIso,
      updatedByUid: authResult.uid,
      updatedByEmail: authResult.email,
    };

    // Atomic batch write: settings/site, settings/staticPages sync, and audit_logs
    const batch = firestore.batch();

    // 1. settings/site
    const siteSettingsRef = firestore.collection("settings").doc("site");
    batch.set(siteSettingsRef, updatePayload, { merge: true });

    // 2. settings/staticPages (keep legal copy in sync)
    const staticPagesRef = firestore.collection("settings").doc("staticPages");
    const staticSync: Record<string, any> = { updatedAt: nowIso };
    if (typeof body.privacyPolicyContent === "string") staticSync.privacy = body.privacyPolicyContent;
    if (typeof body.termsContent === "string") staticSync.terms = body.termsContent;
    if (typeof body.dmcaContent === "string") staticSync.dmca = body.dmcaContent;
    if (typeof body.disclaimerContent === "string") staticSync.disclaimer = body.disclaimerContent;
    batch.set(staticPagesRef, staticSync, { merge: true });

    // 3. Append tamper-proof audit log
    const auditRef = firestore.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "Settings Changed",
      details: "Updated platform settings & SEO configuration via Webmaster API",
      actorUid: authResult.uid || "webmaster",
      actorEmail: authResult.email || "webmaster@linkcloud.in",
      timestamp: nowIso,
    });

    await batch.commit();

    sendJson(res, {
      success: true,
      message: "Webmaster settings saved successfully.",
      updatedAt: nowIso,
    });
  } catch (err: any) {
    console.error("[Admin API] Failed to save settings:", err);
    sendJson(res, { error: err?.message || "Failed to persist settings." }, 500);
  }
}

// ─── Website-Wide Announcements API Handlers ──────────────────────────────────

function validateAnnouncementPayload(body: any): { valid: boolean; error?: string; cleaned?: any } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Malformed payload: Expected JSON object." };
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return { valid: false, error: "Announcement title is required." };
  }
  if (title.length > 100) {
    return { valid: false, error: "Announcement title cannot exceed 100 characters." };
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return { valid: false, error: "Announcement message is required." };
  }
  if (message.length > 500) {
    return { valid: false, error: "Announcement message cannot exceed 500 characters." };
  }

  const validTypes = ["info", "announcement", "important", "warning", "maintenance", "success"];
  const type = validTypes.includes(body.type) ? body.type : "announcement";

  const validDisplayModes = ["banner", "ticker"];
  const displayMode = validDisplayModes.includes(body.displayMode) ? body.displayMode : "banner";

  const priority = typeof body.priority === "number" && !isNaN(body.priority)
    ? Math.max(1, Math.min(100, Math.floor(body.priority)))
    : 10;

  const enabled = body.enabled !== false;
  const dismissible = body.dismissible !== false;

  let actionLabel = typeof body.actionLabel === "string" ? body.actionLabel.trim() : undefined;
  if (actionLabel && actionLabel.length > 50) {
    return { valid: false, error: "Action button label cannot exceed 50 characters." };
  }

  let actionUrl = typeof body.actionUrl === "string" ? body.actionUrl.trim() : undefined;
  if (actionUrl) {
    if (actionUrl.length > 300) {
      return { valid: false, error: "Action URL cannot exceed 300 characters." };
    }
    const lowerUrl = actionUrl.toLowerCase();
    if (
      lowerUrl.startsWith("javascript:") ||
      lowerUrl.startsWith("data:") ||
      lowerUrl.startsWith("vbscript:") ||
      lowerUrl.startsWith("file:")
    ) {
      return { valid: false, error: "Disallowed protocol in Action URL." };
    }
  }

  let startAt = body.startAt ? String(body.startAt).trim() : null;
  let endAt = body.endAt ? String(body.endAt).trim() : null;

  if (startAt) {
    const startTime = new Date(startAt).getTime();
    if (isNaN(startTime)) {
      return { valid: false, error: "Invalid startAt date format." };
    }
  }

  if (endAt) {
    const endTime = new Date(endAt).getTime();
    if (isNaN(endTime)) {
      return { valid: false, error: "Invalid endAt date format." };
    }
    if (startAt) {
      const startTime = new Date(startAt).getTime();
      if (endTime <= startTime) {
        return { valid: false, error: "Schedule end date must be after start date." };
      }
    }
  }

  return {
    valid: true,
    cleaned: {
      title,
      message,
      type,
      displayMode,
      priority,
      enabled,
      dismissible,
      actionLabel: actionLabel || null,
      actionUrl: actionUrl || null,
      startAt: startAt || null,
      endAt: endAt || null,
    },
  };
}

/**
 * GET /api/announcements
 * Public endpoint for retrieving currently active announcements
 */
export async function handleAnnouncementsGetRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, { error: "Method not allowed. Use GET." }, 405);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firestore unavailable." }, 503);
    return;
  }

  try {
    const firestore = getFirestore(app);
    const snap = await firestore
      .collection("announcements")
      .where("enabled", "==", true)
      .get();

    const now = Date.now();
    const announcements: any[] = [];

    snap.forEach((doc) => {
      const data = doc.data();
      const item = {
        id: doc.id,
        ...data,
      };

      if (item.startAt) {
        const start = new Date(item.startAt).getTime();
        if (!isNaN(start) && start > now) return;
      }
      if (item.endAt) {
        const end = new Date(item.endAt).getTime();
        if (!isNaN(end) && end < now) return;
      }

      announcements.push(item);
    });

    announcements.sort((a, b) => {
      const pDiff = (b.priority ?? 10) - (a.priority ?? 10);
      if (pDiff !== 0) return pDiff;
      const tA = a.startAt ? new Date(a.startAt).getTime() : 0;
      const tB = b.startAt ? new Date(b.startAt).getTime() : 0;
      if (tB !== tA) return tB - tA;
      return String(a.id).localeCompare(String(b.id));
    });

    sendJson(res, { success: true, announcements });
  } catch (err: any) {
    console.error("[Admin API] Failed to fetch announcements:", err);
    sendJson(res, { error: "Failed to retrieve announcements." }, 500);
  }
}

/**
 * GET /api/admin/announcements
 * Webmaster endpoint to list ALL announcements (including disabled/expired)
 */
export async function handleAdminAnnouncementsListRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }

  const auth = await verifyWebmasterToken(req);
  if (!auth.valid) {
    sendJson(res, { error: auth.error }, auth.statusCode || 401);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firestore unavailable." }, 503);
    return;
  }

  try {
    const firestore = getFirestore(app);
    const snap = await firestore.collection("announcements").get();
    const items: any[] = [];
    snap.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    items.sort((a, b) => {
      const pDiff = (b.priority ?? 10) - (a.priority ?? 10);
      if (pDiff !== 0) return pDiff;
      return String(a.id).localeCompare(String(b.id));
    });

    sendJson(res, { success: true, announcements: items });
  } catch (err: any) {
    console.error("[Admin API] Announcements list error:", err);
    sendJson(res, { error: "Failed to list announcements." }, 500);
  }
}

/**
 * POST /api/admin/announcements
 * Webmaster creates a new announcement
 */
export async function handleAdminAnnouncementCreateRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }

  const auth = await verifyWebmasterToken(req);
  if (!auth.valid) {
    sendJson(res, { error: auth.error }, auth.statusCode || 401);
    return;
  }

  const body = await parseBody(req);
  const validation = validateAnnouncementPayload(body);
  if (!validation.valid) {
    sendJson(res, { error: validation.error }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firestore unavailable." }, 503);
    return;
  }

  try {
    const firestore = getFirestore(app);
    const nowIso = new Date().toISOString();
    const cleaned = validation.cleaned!;

    const docData = {
      ...cleaned,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: auth.uid || "webmaster",
      updatedBy: auth.uid || "webmaster",
    };

    const docRef = await firestore.collection("announcements").add(docData);

    // Audit log
    await firestore.collection("audit_logs").add({
      action: "Announcement Created",
      details: `Created site-wide announcement: "${cleaned.title}" [${cleaned.type}, ${cleaned.displayMode}, priority ${cleaned.priority}]`,
      actorUid: auth.uid || "webmaster",
      actorEmail: auth.email || "webmaster@linkcloud.in",
      timestamp: nowIso,
    });

    sendJson(res, {
      success: true,
      message: "Announcement created successfully.",
      id: docRef.id,
      announcement: { id: docRef.id, ...docData },
    });
  } catch (err: any) {
    console.error("[Admin API] Create announcement error:", err);
    sendJson(res, { error: err?.message || "Failed to create announcement." }, 500);
  }
}

/**
 * PUT/PATCH /api/admin/announcements
 * Webmaster updates an existing announcement
 */
export async function handleAdminAnnouncementUpdateRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }

  const auth = await verifyWebmasterToken(req);
  if (!auth.valid) {
    sendJson(res, { error: auth.error }, auth.statusCode || 401);
    return;
  }

  const body = await parseBody(req);
  const id = body.id || (req.url?.includes("id=") ? new URLSearchParams(req.url.split("?")[1]).get("id") : null);
  if (!id || typeof id !== "string") {
    sendJson(res, { error: "Announcement ID is required." }, 400);
    return;
  }

  const validation = validateAnnouncementPayload(body);
  if (!validation.valid) {
    sendJson(res, { error: validation.error }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firestore unavailable." }, 503);
    return;
  }

  try {
    const firestore = getFirestore(app);
    const docRef = firestore.collection("announcements").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      sendJson(res, { error: "Announcement not found." }, 404);
      return;
    }

    const nowIso = new Date().toISOString();
    const cleaned = validation.cleaned!;

    const updateData = {
      ...cleaned,
      updatedAt: nowIso,
      updatedBy: auth.uid || "webmaster",
    };

    await docRef.set(updateData, { merge: true });

    // Audit log
    await firestore.collection("audit_logs").add({
      action: "Announcement Updated",
      details: `Updated site-wide announcement "${cleaned.title}" (ID: ${id})`,
      actorUid: auth.uid || "webmaster",
      actorEmail: auth.email || "webmaster@linkcloud.in",
      timestamp: nowIso,
    });

    sendJson(res, {
      success: true,
      message: "Announcement updated successfully.",
      announcement: { id, ...updateData },
    });
  } catch (err: any) {
    console.error("[Admin API] Update announcement error:", err);
    sendJson(res, { error: err?.message || "Failed to update announcement." }, 500);
  }
}

/**
 * DELETE /api/admin/announcements
 * Webmaster deletes an announcement
 */
export async function handleAdminAnnouncementDeleteRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }

  const auth = await verifyWebmasterToken(req);
  if (!auth.valid) {
    sendJson(res, { error: auth.error }, auth.statusCode || 401);
    return;
  }

  const body = await parseBody(req);
  const id = body.id || (req.url?.includes("id=") ? new URLSearchParams(req.url.split("?")[1]).get("id") : null);
  if (!id || typeof id !== "string") {
    sendJson(res, { error: "Announcement ID is required for deletion." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { error: "Firestore unavailable." }, 503);
    return;
  }

  try {
    const firestore = getFirestore(app);
    const docRef = firestore.collection("announcements").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      sendJson(res, { error: "Announcement not found." }, 404);
      return;
    }

    const title = existing.data()?.title || id;
    await docRef.delete();

    // Audit log
    await firestore.collection("audit_logs").add({
      action: "Announcement Deleted",
      details: `Deleted site-wide announcement "${title}" (ID: ${id})`,
      actorUid: auth.uid || "webmaster",
      actorEmail: auth.email || "webmaster@linkcloud.in",
      timestamp: new Date().toISOString(),
    });

    sendJson(res, {
      success: true,
      message: "Announcement deleted successfully.",
    });
  } catch (err: any) {
    console.error("[Admin API] Delete announcement error:", err);
    sendJson(res, { error: err?.message || "Failed to delete announcement." }, 500);
  }
}


