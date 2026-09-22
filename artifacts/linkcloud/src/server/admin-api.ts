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
    if (targetWebmasterDoc.exists && targetWebmasterDoc.data()?.role === "webmaster") {
      sendJson(
        res,
        { error: "Self-Protection: You cannot alter the status of a protected Webmaster account." },
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
    if (targetWebmasterDoc.exists && targetWebmasterDoc.data()?.role === "webmaster") {
      sendJson(
        res,
        { error: "Self-Protection: You cannot delete a protected Webmaster account." },
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
