"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_node_http = __toESM(require("node:http"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);

// artifacts/linkcloud/src/server/admin-api.ts
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var import_firestore = require("firebase-admin/firestore");
var adminApp = null;
function getFirebaseAdminApp() {
  if (adminApp) return adminApp;
  const existingApps = (0, import_app.getApps)();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }
  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "linkcloud-5bb2f";
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const sa = typeof process.env.FIREBASE_SERVICE_ACCOUNT_KEY === "string" ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) : process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        credential = (0, import_app.cert)(sa);
      } catch (saErr) {
        console.warn("[Firebase Admin SDK] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:", saErr);
      }
    }
    adminApp = (0, import_app.initializeApp)({
      projectId,
      ...credential ? { credential } : {}
    });
    return adminApp;
  } catch (err) {
    console.warn("[Firebase Admin SDK] Initialization notice:", err);
    return null;
  }
}
function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}
function parseBody(req) {
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
async function verifyWebmasterToken(req) {
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: "Authentication required: Missing Bearer token.",
      statusCode: 401
    };
  }
  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) {
    return {
      valid: false,
      error: "Authentication required: Empty Bearer token.",
      statusCode: 401
    };
  }
  const app = getFirebaseAdminApp();
  if (!app) {
    return {
      valid: false,
      error: "Server authentication service unavailable.",
      statusCode: 503
    };
  }
  try {
    const auth = (0, import_auth.getAuth)(app);
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";
    const firestore = (0, import_firestore.getFirestore)(app);
    const webmasterDoc = await firestore.collection("webmaster").doc(uid).get();
    if (webmasterDoc.exists) {
      const data = webmasterDoc.data() || {};
      if (data.active !== false && (data.role === "webmaster" || !data.role)) {
        return { valid: true, uid, email };
      }
    }
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
      statusCode: 403
    };
  } catch (err) {
    console.warn("[Admin API] Token verification failed:", err?.message || err);
    return {
      valid: false,
      error: "Invalid or expired authentication token.",
      statusCode: 401
    };
  }
}
async function handleAdminUserStatusRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }
  const callerUid = authResult.uid;
  const callerEmail = authResult.email || "webmaster@linkcloud.in";
  const data = await parseBody(req);
  const { uid: targetUid, status } = data;
  if (!targetUid || typeof targetUid !== "string") {
    sendJson(res, { error: "Missing or invalid 'uid' parameter." }, 400);
    return;
  }
  if (targetUid === callerUid && (status === "suspended" || status === "banned" || status === "deleted")) {
    sendJson(
      res,
      { error: "Self-Protection: You cannot suspend, ban, or deactivate your active Webmaster account." },
      403
    );
    return;
  }
  const app = getFirebaseAdminApp();
  const auth = (0, import_auth.getAuth)(app);
  const firestore = (0, import_firestore.getFirestore)(app);
  try {
    const targetWebmasterDoc = await firestore.collection("webmaster").doc(targetUid).get();
    const targetUserDoc = await firestore.collection("users").doc(targetUid).get();
    const isTargetWebmaster = Boolean(
      targetWebmasterDoc.exists && (targetWebmasterDoc.data()?.role === "webmaster" || targetWebmasterDoc.data()?.active === true) || targetUserDoc.exists && targetUserDoc.data()?.role === "webmaster"
    );
    if (isTargetWebmaster) {
      const webmastersSnap = await firestore.collection("webmaster").get();
      const activeCount = webmastersSnap.docs.filter((d) => {
        const data2 = d.data();
        return data2.active !== false && (data2.role === "webmaster" || !data2.role);
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
    } catch (authErr) {
      console.warn(`[Admin API] Auth update notice for ${targetUid}:`, authErr.message);
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const userRef = firestore.collection("users").doc(targetUid);
    await userRef.set(
      {
        status,
        updatedAt: nowIso,
        statusUpdatedBy: callerEmail,
        statusUpdatedAt: nowIso
      },
      { merge: true }
    );
    await firestore.collection("auditLogs").add({
      action: shouldDisable ? "USER_SUSPENDED" : "USER_STATUS_UPDATED",
      targetUid,
      actorUid: callerUid,
      details: { newStatus: status, disabled: shouldDisable, actorEmail: callerEmail },
      timestamp: nowIso
    });
    console.log("[Admin API] Updated user status successfully:", {
      targetUid,
      newStatus: status,
      callerUid
    });
    sendJson(res, {
      success: true,
      uid: targetUid,
      status,
      disabled: shouldDisable,
      authUpdated,
      timestamp: nowIso
    });
  } catch (err) {
    console.error("[Admin API] Failed to update user status:", err);
    sendJson(res, { error: err?.message || "Failed to update user status." }, 500);
  }
}
async function handleAdminUserDeleteRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }
  const callerUid = authResult.uid;
  const callerEmail = authResult.email || "webmaster@linkcloud.in";
  const data = await parseBody(req);
  const { uid: targetUid, reason } = data;
  if (!targetUid || typeof targetUid !== "string") {
    sendJson(res, { error: "Missing or invalid 'uid' parameter." }, 400);
    return;
  }
  if (targetUid === callerUid) {
    sendJson(
      res,
      { error: "Self-Protection: You cannot delete your active Webmaster account." },
      403
    );
    return;
  }
  const app = getFirebaseAdminApp();
  const auth = (0, import_auth.getAuth)(app);
  const firestore = (0, import_firestore.getFirestore)(app);
  try {
    const targetWebmasterDoc = await firestore.collection("webmaster").doc(targetUid).get();
    const targetUserDoc = await firestore.collection("users").doc(targetUid).get();
    const isTargetWebmaster = Boolean(
      targetWebmasterDoc.exists && (targetWebmasterDoc.data()?.role === "webmaster" || targetWebmasterDoc.data()?.active === true) || targetUserDoc.exists && targetUserDoc.data()?.role === "webmaster"
    );
    if (isTargetWebmaster) {
      const webmastersSnap = await firestore.collection("webmaster").get();
      const activeCount = webmastersSnap.docs.filter((d) => {
        const data2 = d.data();
        return data2.active !== false && (data2.role === "webmaster" || !data2.role);
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
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const userDocRef = firestore.collection("users").doc(targetUid);
    const userSnap = await userDocRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const targetEmail = userData.email || "";
    const targetPhone = userData.phone || "";
    const targetAccountUid = userData.accountUid || targetUid;
    let authDeleted = false;
    try {
      await auth.deleteUser(targetUid);
      authDeleted = true;
    } catch (authErr) {
      console.warn(`[Admin API] Auth delete notice for ${targetUid}:`, authErr.message);
    }
    await firestore.collection("deletedAccounts").doc(targetUid).set({
      uid: targetUid,
      accountUid: targetAccountUid,
      email: targetEmail,
      phone: targetPhone,
      deletedAt: nowIso,
      deletedBy: callerEmail,
      deletedByUid: callerUid,
      reason: reason || "Webmaster administrative deletion"
    });
    const batch = firestore.batch();
    if (targetEmail) {
      batch.delete(firestore.collection("emailIndex").doc(targetEmail.toLowerCase()));
    }
    if (targetPhone) {
      batch.delete(firestore.collection("mobileIndex").doc(targetPhone));
    }
    batch.delete(userDocRef);
    const auditLogRef = firestore.collection("auditLogs").doc();
    batch.set(auditLogRef, {
      action: "USER_DELETED_ADMIN",
      targetUid,
      actorUid: callerUid,
      details: {
        targetAccountUid,
        targetEmail,
        actorEmail: callerEmail,
        reason: reason || "Webmaster administrative deletion"
      },
      timestamp: nowIso
    });
    await batch.commit();
    console.log("[Admin API] Permanently deleted user:", { targetUid, callerUid });
    sendJson(res, {
      success: true,
      uid: targetUid,
      authDeleted,
      timestamp: nowIso
    });
  } catch (err) {
    console.error("[Admin API] Failed to delete user:", err);
    sendJson(res, { error: err?.message || "Failed to delete user." }, 500);
  }
}
async function handleAdminStatsRequest(req, res) {
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
  const app = getFirebaseAdminApp();
  const firestore = (0, import_firestore.getFirestore)(app);
  try {
    const [usersSnap, groupsSnap, reportsSnap, complaintsSnap, counterSnap] = await Promise.all([
      firestore.collection("users").count().get(),
      firestore.collection("groups").count().get(),
      firestore.collection("reports").count().get(),
      firestore.collection("complaints").count().get(),
      firestore.collection("counters").doc("userSequence").get()
    ]);
    const userSequence = counterSnap.exists ? counterSnap.data() : { currentNumber: 100, prefix: "linkcloud" };
    sendJson(res, {
      success: true,
      stats: {
        totalUsers: usersSnap.data().count,
        totalGroups: groupsSnap.data().count,
        totalReports: reportsSnap.data().count,
        totalComplaints: complaintsSnap.data().count,
        userSequence
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("[Admin API] Failed to fetch stats:", err);
    sendJson(res, { error: err?.message || "Failed to fetch stats." }, 500);
  }
}
async function handleAdminMigrationDryRunRequest(req, res) {
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
  const app = getFirebaseAdminApp();
  const firestore = (0, import_firestore.getFirestore)(app);
  try {
    const usersSnap = await firestore.collection("users").get();
    const groupsSnap = await firestore.collection("groups").get();
    const counterSnap = await firestore.collection("counters").doc("userSequence").get();
    const emailIndexSnap = await firestore.collection("emailIndex").get();
    const mobileIndexSnap = await firestore.collection("mobileIndex").get();
    const registrySnap = await firestore.collection("accountUidRegistry").get();
    const userIds = /* @__PURE__ */ new Set();
    const legacyUids = [];
    const canonicalUids = [];
    const duplicateEmails = /* @__PURE__ */ new Map();
    const duplicatePhones = /* @__PURE__ */ new Map();
    const usersWithoutIndex = [];
    const indexedEmails = /* @__PURE__ */ new Set();
    const indexedPhones = /* @__PURE__ */ new Set();
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
    const orphanedGroups = [];
    groupsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.submittedBy && !userIds.has(data.submittedBy)) {
        orphanedGroups.push(doc.id);
      }
    });
    const sequenceData = counterSnap.exists ? counterSnap.data() : { currentNumber: 100, prefix: "linkcloud" };
    const report = {
      dryRun: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      summary: {
        totalUsers: usersSnap.size,
        totalGroups: groupsSnap.size,
        canonicalUidCount: canonicalUids.length,
        legacyUidCount: legacyUids.length,
        indexedEmailCount: emailIndexSnap.size,
        indexedPhoneCount: mobileIndexSnap.size,
        registryCount: registrySnap.size,
        orphanedGroupCount: orphanedGroups.length,
        unindexedUserCount: usersWithoutIndex.length
      },
      sequence: sequenceData,
      legacyUids: legacyUids.slice(0, 50),
      orphanedGroupSample: orphanedGroups.slice(0, 20),
      unindexedUserSample: usersWithoutIndex.slice(0, 20),
      status: "READY_FOR_SEQUENTIAL_PROVISIONING"
    };
    sendJson(res, { success: true, report });
  } catch (err) {
    console.error("[Admin API] Dry-run error:", err);
    sendJson(res, { error: err?.message || "Failed to perform migration dry-run." }, 500);
  }
}
async function handleAdminCleanupUnverifiedRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret"
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
    const cronSecretHeader = ((Array.isArray(req.headers["x-cron-secret"]) ? req.headers["x-cron-secret"][0] : req.headers["x-cron-secret"]) || "").trim();
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
        const auth2 = await verifyWebmasterToken(req);
        if (!auth2.valid) {
          sendJson(res, { error: auth2.error || "Webmaster authentication required" }, auth2.statusCode || 403);
          return;
        }
        callerActor = auth2.email || "webmaster";
      }
    }
    const app = getFirebaseAdminApp();
    const auth = (0, import_auth.getAuth)(app);
    const firestore = (0, import_firestore.getFirestore)(app);
    const now = Date.now();
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1e3;
    const cutoffTime = now - FOUR_HOURS_MS;
    const cutoffIso = new Date(cutoffTime).toISOString();
    const candidateUids = /* @__PURE__ */ new Map();
    try {
      const pendingSnap = await firestore.collection("pendingRegistrations").get();
      pendingSnap.forEach((doc) => {
        const d = doc.data();
        candidateUids.set(doc.id, {
          uid: doc.id,
          email: (d.email || "").trim().toLowerCase(),
          phone: d.phone || "",
          createdAt: d.registrationCreatedAt || d.createdAt || ""
        });
      });
    } catch (e) {
      console.warn("[Admin API] pendingRegistrations read note:", e);
    }
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
              createdAt: d.registrationCreatedAt || d.createdAt || ""
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
    const results = [];
    for (const [uid, candidate] of candidateUids.entries()) {
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
      const regTimestampStr = candidate.createdAt || userData?.registrationCreatedAt || userData?.createdAt;
      const regTimeMs = regTimestampStr ? new Date(regTimestampStr).getTime() : 0;
      let authUser = null;
      try {
        authUser = await auth.getUser(uid);
      } catch {
      }
      const authCreatedMs = authUser?.metadata?.creationTime ? new Date(authUser.metadata.creationTime).getTime() : 0;
      const effectiveCreationMs = regTimeMs || authCreatedMs;
      if (effectiveCreationMs > 0 && effectiveCreationMs > cutoffTime) {
        skippedRecentCount++;
        results.push({
          uid,
          email: candidate.email,
          status: "SKIPPED_TOO_RECENT",
          ageMinutes: Math.round((now - effectiveCreationMs) / (60 * 1e3))
        });
        continue;
      }
      if (authUser?.emailVerified === true || userData?.emailVerified === true || userData?.status === "active") {
        skippedVerifiedCount++;
        await firestore.collection("pendingRegistrations").doc(uid).delete().catch(() => {
        });
        results.push({ uid, email: candidate.email, status: "SKIPPED_VERIFIED" });
        continue;
      }
      if (authUser?.providerData?.some((p) => p.providerId === "google.com")) {
        skippedProtectedCount++;
        results.push({ uid, email: candidate.email, status: "SKIPPED_GOOGLE_ACCOUNT" });
        continue;
      }
      const cleanEmail = (candidate.email || userData?.email || "").toLowerCase();
      const cleanPhone = candidate.phone || userData?.phone || "";
      if (authUser) {
        await auth.deleteUser(uid).catch((err) => {
          console.warn(`[Admin API] Auth delete notice for ${uid}:`, err.message);
        });
      }
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
      const auditRef = firestore.collection("auditLogs").doc();
      batch.set(auditRef, {
        action: "UNVERIFIED_PROVISIONAL_EXPIRED_CLEANUP",
        targetUid: uid,
        actorUid: callerActor,
        details: {
          email: cleanEmail,
          accountUid: uid,
          registeredAt: regTimestampStr,
          cleanedAt: (/* @__PURE__ */ new Date()).toISOString(),
          reason: "Unverified provisional registration expired after 4-hour threshold"
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
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
      results
    });
  } catch (err) {
    console.error("[Admin API] Cleanup error:", err);
    sendJson(res, { error: err?.message || "Failed to execute cleanup." }, 500);
  }
}
async function handleAdminSettingsGetRequest(req, res) {
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
    const firestore = (0, import_firestore.getFirestore)(app);
    const snap = await firestore.collection("settings").doc("site").get();
    if (!snap.exists) {
      sendJson(res, { success: true, settings: null });
      return;
    }
    sendJson(res, { success: true, settings: snap.data() });
  } catch (err) {
    console.warn("[Admin API] Settings fetch error:", err?.message || err);
    sendJson(res, { error: "Failed to retrieve settings." }, 500);
  }
}
async function handleAdminSettingsUpdateRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, {}, 204);
    return;
  }
  if (req.method !== "POST" && req.method !== "PUT") {
    sendJson(res, { error: "Method not allowed. Use POST or PUT." }, 405);
    return;
  }
  const authResult = await verifyWebmasterToken(req);
  if (!authResult.valid) {
    sendJson(res, { error: authResult.error }, authResult.statusCode || 401);
    return;
  }
  const body = await parseBody(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(res, { error: "Malformed payload: Expected JSON object." }, 400);
    return;
  }
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
    "token"
  ];
  for (const key of forbiddenKeys) {
    if (key in body) {
      delete body[key];
    }
  }
  if (typeof body.structuredDataJson === "string" && body.structuredDataJson.trim().length > 0) {
    try {
      JSON.parse(body.structuredDataJson);
    } catch (parseErr) {
      sendJson(
        res,
        {
          error: `Invalid JSON syntax in structuredDataJson: ${parseErr.message}`
        },
        400
      );
      return;
    }
  }
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
    "githubUrl"
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
  if (typeof body.canonicalUrl === "string" && body.canonicalUrl.trim().length > 0) {
    const trimmedCanonical = body.canonicalUrl.trim();
    if (!trimmedCanonical.startsWith("http://") && !trimmedCanonical.startsWith("https://")) {
      sendJson(res, { error: "Canonical URL must start with http:// or https://" }, 400);
      return;
    }
  }
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
    const firestore = (0, import_firestore.getFirestore)(app);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const updatePayload = {
      ...body,
      updatedAt: nowIso,
      updatedByUid: authResult.uid,
      updatedByEmail: authResult.email
    };
    const batch = firestore.batch();
    const siteSettingsRef = firestore.collection("settings").doc("site");
    batch.set(siteSettingsRef, updatePayload, { merge: true });
    const staticPagesRef = firestore.collection("settings").doc("staticPages");
    const staticSync = { updatedAt: nowIso };
    if (typeof body.privacyPolicyContent === "string") staticSync.privacy = body.privacyPolicyContent;
    if (typeof body.termsContent === "string") staticSync.terms = body.termsContent;
    if (typeof body.dmcaContent === "string") staticSync.dmca = body.dmcaContent;
    if (typeof body.disclaimerContent === "string") staticSync.disclaimer = body.disclaimerContent;
    batch.set(staticPagesRef, staticSync, { merge: true });
    const auditRef = firestore.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "Settings Changed",
      details: "Updated platform settings & SEO configuration via Webmaster API",
      actorUid: authResult.uid || "webmaster",
      actorEmail: authResult.email || "webmaster@linkcloud.in",
      timestamp: nowIso
    });
    await batch.commit();
    sendJson(res, {
      success: true,
      message: "Webmaster settings saved successfully.",
      updatedAt: nowIso
    });
  } catch (err) {
    console.error("[Admin API] Failed to save settings:", err);
    sendJson(res, { error: err?.message || "Failed to persist settings." }, 500);
  }
}
function validateAnnouncementPayload(body) {
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
  const validDisplayModes = ["banner", "ticker", "static", "scrolling"];
  const displayMode = validDisplayModes.includes(body.displayMode) ? body.displayMode : "banner";
  const priority = typeof body.priority === "number" && !isNaN(body.priority) ? Math.max(1, Math.min(100, Math.floor(body.priority))) : 10;
  const enabled = body.enabled !== false;
  const dismissible = body.dismissible !== false;
  let actionLabel = typeof body.actionLabel === "string" ? body.actionLabel.trim() : void 0;
  if (actionLabel && actionLabel.length > 50) {
    return { valid: false, error: "Action button label cannot exceed 50 characters." };
  }
  let actionUrl = typeof body.actionUrl === "string" ? body.actionUrl.trim() : void 0;
  if (actionUrl) {
    if (actionUrl.length > 300) {
      return { valid: false, error: "Action URL cannot exceed 300 characters." };
    }
    const sanitizedUrl = actionUrl.replace(/[\x00-\x1F\x7F\s]+/g, "").toLowerCase();
    if (sanitizedUrl.startsWith("javascript:") || sanitizedUrl.startsWith("data:") || sanitizedUrl.startsWith("vbscript:") || sanitizedUrl.startsWith("file:")) {
      return { valid: false, error: "Disallowed protocol in Action URL." };
    }
    try {
      const decodedUrl = decodeURIComponent(sanitizedUrl).replace(/[\x00-\x1F\x7F\s]+/g, "").toLowerCase();
      if (decodedUrl.startsWith("javascript:") || decodedUrl.startsWith("data:") || decodedUrl.startsWith("vbscript:") || decodedUrl.startsWith("file:")) {
        return { valid: false, error: "Disallowed protocol in Action URL." };
      }
    } catch {
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
      endAt: endAt || null
    }
  };
}
async function handleAnnouncementsGetRequest(req, res) {
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
    const firestore = (0, import_firestore.getFirestore)(app);
    const snap = await firestore.collection("announcements").where("enabled", "==", true).get();
    const now = Date.now();
    const announcements = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const item = {
        id: doc.id,
        ...data
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
  } catch (err) {
    console.error("[Admin API] Failed to fetch announcements:", err);
    sendJson(res, { error: "Failed to retrieve announcements." }, 500);
  }
}
async function handleAdminAnnouncementsListRequest(req, res) {
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
    const firestore = (0, import_firestore.getFirestore)(app);
    const snap = await firestore.collection("announcements").get();
    const items = [];
    snap.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    items.sort((a, b) => {
      const pDiff = (b.priority ?? 10) - (a.priority ?? 10);
      if (pDiff !== 0) return pDiff;
      return String(a.id).localeCompare(String(b.id));
    });
    sendJson(res, { success: true, announcements: items });
  } catch (err) {
    console.error("[Admin API] Announcements list error:", err);
    sendJson(res, { error: "Failed to list announcements." }, 500);
  }
}
async function handleAdminAnnouncementCreateRequest(req, res) {
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
    const firestore = (0, import_firestore.getFirestore)(app);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const cleaned = validation.cleaned;
    const docData = {
      ...cleaned,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: auth.uid || "webmaster",
      updatedBy: auth.uid || "webmaster"
    };
    const docRef = await firestore.collection("announcements").add(docData);
    await firestore.collection("audit_logs").add({
      action: "Announcement Created",
      details: `Created site-wide announcement: "${cleaned.title}" [${cleaned.type}, ${cleaned.displayMode}, priority ${cleaned.priority}]`,
      actorUid: auth.uid || "webmaster",
      actorEmail: auth.email || "webmaster@linkcloud.in",
      timestamp: nowIso
    });
    sendJson(res, {
      success: true,
      message: "Announcement created successfully.",
      id: docRef.id,
      announcement: { id: docRef.id, ...docData }
    });
  } catch (err) {
    console.error("[Admin API] Create announcement error:", err);
    sendJson(res, { error: err?.message || "Failed to create announcement." }, 500);
  }
}
async function handleAdminAnnouncementUpdateRequest(req, res) {
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
    const firestore = (0, import_firestore.getFirestore)(app);
    const docRef = firestore.collection("announcements").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      sendJson(res, { error: "Announcement not found." }, 404);
      return;
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const cleaned = validation.cleaned;
    const updateData = {
      ...cleaned,
      updatedAt: nowIso,
      updatedBy: auth.uid || "webmaster"
    };
    await docRef.set(updateData, { merge: true });
    await firestore.collection("audit_logs").add({
      action: "Announcement Updated",
      details: `Updated site-wide announcement "${cleaned.title}" (ID: ${id})`,
      actorUid: auth.uid || "webmaster",
      actorEmail: auth.email || "webmaster@linkcloud.in",
      timestamp: nowIso
    });
    sendJson(res, {
      success: true,
      message: "Announcement updated successfully.",
      announcement: { id, ...updateData }
    });
  } catch (err) {
    console.error("[Admin API] Update announcement error:", err);
    sendJson(res, { error: err?.message || "Failed to update announcement." }, 500);
  }
}
async function handleAdminAnnouncementDeleteRequest(req, res) {
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
    const firestore = (0, import_firestore.getFirestore)(app);
    const docRef = firestore.collection("announcements").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      sendJson(res, { error: "Announcement not found." }, 404);
      return;
    }
    const title = existing.data()?.title || id;
    await docRef.delete();
    await firestore.collection("audit_logs").add({
      action: "Announcement Deleted",
      details: `Deleted site-wide announcement "${title}" (ID: ${id})`,
      actorUid: auth.uid || "webmaster",
      actorEmail: auth.email || "webmaster@linkcloud.in",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    sendJson(res, {
      success: true,
      message: "Announcement deleted successfully."
    });
  } catch (err) {
    console.error("[Admin API] Delete announcement error:", err);
    sendJson(res, { error: err?.message || "Failed to delete announcement." }, 500);
  }
}

// artifacts/linkcloud/src/server/dev-email-change.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_auth2 = require("firebase-admin/auth");
var import_firestore2 = require("firebase-admin/firestore");
var EMAIL_CHANGE_TTL_MS = 5 * 60 * 1e3;
var EMAIL_RESEND_COOLDOWN_MS = 30 * 1e3;
function sendJson2(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}
function parseBody2(req) {
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
function hashToken(rawToken) {
  return import_crypto.default.createHash("sha256").update(rawToken).digest("hex");
}
async function handleDevEmailChangeRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson2(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson2(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    sendJson2(res, { error: "Authentication required: Missing Bearer token." }, 401);
    return;
  }
  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) {
    sendJson2(res, { error: "Authentication required: Empty Bearer token." }, 401);
    return;
  }
  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson2(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }
  let uid = "";
  let currentAuthEmail = "";
  try {
    const decoded = await (0, import_auth2.getAuth)(app).verifyIdToken(idToken);
    uid = decoded.uid;
    currentAuthEmail = decoded.email || "";
  } catch (e) {
    sendJson2(res, { error: `Authentication failed: ${e.message}` }, 401);
    return;
  }
  const body = await parseBody2(req);
  const newEmail = (body.newEmail || "").trim().toLowerCase();
  currentAuthEmail = currentAuthEmail || (body.currentEmail || "").trim().toLowerCase();
  if (!newEmail || !newEmail.endsWith("@gmail.com")) {
    sendJson2(res, { error: "Only personal Gmail addresses (@gmail.com) are supported." }, 400);
    return;
  }
  if (currentAuthEmail && newEmail === currentAuthEmail) {
    sendJson2(res, { error: "New email must be different from your current email." }, 400);
    return;
  }
  const firestore = app ? (0, import_firestore2.getFirestore)(app) : null;
  const now = Date.now();
  if (firestore) {
    try {
      const existingIndexDoc = await firestore.collection("emailIndex").doc(newEmail).get();
      if (existingIndexDoc.exists && existingIndexDoc.data()?.uid && existingIndexDoc.data()?.uid !== uid) {
        sendJson2(res, { error: "This Gmail address is already registered to another account." }, 409);
        return;
      }
    } catch (idxErr) {
      console.warn("[Dev Server] emailIndex check note:", idxErr);
    }
  }
  if (firestore) {
    try {
      const recentReqs = await firestore.collection("emailChangeRequests").where("userId", "==", uid).orderBy("createdAt", "desc").limit(1).get();
      if (!recentReqs.empty) {
        const lastCreated = recentReqs.docs[0].data().createdAtMs || 0;
        if (now - lastCreated < EMAIL_RESEND_COOLDOWN_MS) {
          const waitSec = Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (now - lastCreated)) / 1e3);
          res.setHeader("Retry-After", String(waitSec));
          sendJson2(
            res,
            {
              success: false,
              error: `Please wait ${waitSec}s before requesting another verification email.`,
              retryAfter: waitSec
            },
            429
          );
          return;
        }
      }
    } catch (cdErr) {
      console.warn("[Dev Server] Cooldown check note:", cdErr);
    }
  }
  const rawToken = import_crypto.default.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const requestId = `req_${uid}_${now}`;
  const expiresAt = now + EMAIL_CHANGE_TTL_MS;
  if (firestore) {
    try {
      const existingPending = await firestore.collection("emailChangeRequests").where("userId", "==", uid).where("status", "==", "pending").get();
      const batch = firestore.batch();
      existingPending.forEach((doc) => {
        batch.update(doc.ref, { status: "superseded", supersededAt: (/* @__PURE__ */ new Date()).toISOString() });
      });
      const newReqRef = firestore.collection("emailChangeRequests").doc(requestId);
      batch.set(newReqRef, {
        requestId,
        userId: uid,
        oldEmail: currentAuthEmail,
        newEmail,
        tokenHash,
        expiresAt,
        expiresAtIso: new Date(expiresAt).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAtMs: now,
        status: "pending"
      });
      await batch.commit();
    } catch (saveErr) {
      console.error("[Dev Server] Failed to save emailChangeRequest to Firestore:", saveErr);
    }
  }
  const resendApiKey = process.env.RESEND_API_KEY;
  const host = req.headers["host"] || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const verificationLink = `${origin}/verify-handler?mode=verifyAndChangeEmail&reqId=${requestId}&uid=${uid}&token=${rawToken}`;
  console.log(`[Dev Server] Email Change Requested for UID ${uid} -> ${newEmail}`);
  console.log(`[Dev Server] Verification link: ${verificationLink}`);
  if (resendApiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "LinkCloud Security <verify@linkcloud.in>",
          to: [newEmail],
          subject: "Confirm your LinkCloud email change",
          html: `<p>Please click this link to confirm your email change: <a href="${verificationLink}">${verificationLink}</a>. Link is valid for 5 minutes.</p>`
        })
      });
      console.log(`[Dev Server] Resend email dispatched to ${newEmail}`);
    } catch (e) {
      console.warn("[Dev Server] Resend dispatch notice:", e);
    }
  }
  sendJson2(res, {
    success: true,
    requestId,
    expiresAt,
    newEmail,
    nextAllowedAt: now + EMAIL_RESEND_COOLDOWN_MS,
    devVerificationLink: verificationLink,
    message: "Verification email sent. Link is valid for 5 minutes."
  });
}
async function handleDevEmailChangeResend(req, res) {
  return handleDevEmailChangeRequest(req, res);
}
async function handleDevEmailChangeVerify(req, res) {
  if (req.method === "OPTIONS") {
    sendJson2(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson2(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const body = await parseBody2(req);
  const reqId = (body.reqId || body.requestId || "").trim();
  const rawToken = (body.token || body.rawToken || "").trim();
  const uid = (body.uid || "").trim();
  const app = getFirebaseAdminApp();
  const firestore = app ? (0, import_firestore2.getFirestore)(app) : null;
  const now = Date.now();
  if (!firestore) {
    sendJson2(res, { error: "Database service unavailable." }, 500);
    return;
  }
  try {
    const reqDoc = await firestore.collection("emailChangeRequests").doc(reqId).get();
    if (!reqDoc.exists) {
      sendJson2(res, { error: "Invalid or expired verification request." }, 404);
      return;
    }
    const reqData = reqDoc.data();
    if (reqData.status !== "pending") {
      if (reqData.status === "verified") {
        sendJson2(res, {
          success: true,
          verified: true,
          completed: true,
          uid: reqData.userId,
          newEmail: reqData.newEmail,
          message: "Email change already completed."
        });
        return;
      }
      sendJson2(res, { error: `This verification link is no longer valid (${reqData.status}).` }, 400);
      return;
    }
    if (reqData.expiresAt < now) {
      await reqDoc.ref.update({ status: "expired" });
      sendJson2(res, { error: "This verification link has expired. Please request a new one." }, 410);
      return;
    }
    const expectedHash = hashToken(rawToken);
    if (reqData.tokenHash !== expectedHash) {
      sendJson2(res, { error: "Invalid verification token." }, 403);
      return;
    }
    const targetUid = reqData.userId;
    const oldEmail = reqData.oldEmail || "";
    const newEmail = reqData.newEmail;
    let customToken = "";
    try {
      const auth = (0, import_auth2.getAuth)(app);
      await auth.updateUser(targetUid, {
        email: newEmail,
        emailVerified: true
      });
      customToken = await auth.createCustomToken(targetUid);
    } catch (authErr) {
      console.warn("[Dev Server] Auth updateUser warning:", authErr.message);
    }
    const batch = firestore.batch();
    batch.update(reqDoc.ref, {
      status: "verified",
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const userDocRef = firestore.collection("users").doc(targetUid);
    batch.set(
      userDocRef,
      {
        email: newEmail,
        emailVerified: true,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      { merge: true }
    );
    if (oldEmail) {
      batch.delete(firestore.collection("emailIndex").doc(oldEmail.toLowerCase()));
    }
    batch.set(firestore.collection("emailIndex").doc(newEmail.toLowerCase()), {
      uid: targetUid,
      email: newEmail,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const historyRef = userDocRef.collection("email_history").doc();
    batch.set(historyRef, {
      oldEmail,
      newEmail,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      requestId: reqId,
      verifiedVia: "server_dev_verify"
    });
    await batch.commit();
    console.log(`[Dev Server] Verified and updated email for ${targetUid} -> ${newEmail}`);
    sendJson2(res, {
      success: true,
      verified: true,
      completed: true,
      uid: targetUid,
      oldEmail,
      newEmail,
      customToken,
      message: "New email address verified and updated successfully!"
    });
  } catch (err) {
    console.error("[Dev Server] Verification error:", err);
    sendJson2(res, { error: err?.message || "Failed to process verification." }, 500);
  }
}
async function handleDevEmailChangeSessionRefresh(req, res) {
  if (req.method === "OPTIONS") {
    sendJson2(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson2(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const body = await parseBody2(req);
  const uid = (body.uid || "").trim();
  if (!uid) {
    sendJson2(res, { error: "Missing required parameter: uid." }, 400);
    return;
  }
  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson2(res, { error: "Firebase Admin is not configured on dev server." }, 500);
    return;
  }
  try {
    const customToken = await (0, import_auth2.getAuth)(app).createCustomToken(uid);
    sendJson2(res, {
      success: true,
      uid,
      customToken,
      message: "Fresh session custom token generated successfully."
    });
  } catch (err) {
    console.error("[Dev Server] createCustomToken error:", err);
    sendJson2(res, { error: err.message || "Failed to create custom token" }, 500);
  }
}
async function handleDevEmailChangeCancel(req, res) {
  if (req.method === "OPTIONS") {
    sendJson2(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson2(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const body = await parseBody2(req);
  const reqId = (body.reqId || body.requestId || "").trim();
  const app = getFirebaseAdminApp();
  const firestore = app ? (0, import_firestore2.getFirestore)(app) : null;
  if (firestore && reqId) {
    try {
      await firestore.collection("emailChangeRequests").doc(reqId).update({
        status: "cancelled",
        cancelledAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch {
    }
  }
  sendJson2(res, {
    success: true,
    message: "Email change cancelled."
  });
}

// artifacts/linkcloud/src/server/auth-api.ts
var import_auth3 = require("firebase-admin/auth");
var import_firestore3 = require("firebase-admin/firestore");
function sendJson3(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}
function parseBody3(req) {
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
async function allocateNextSequentialUid() {
  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error("Firebase Admin SDK is not initialized.");
  }
  const firestore = (0, import_firestore3.getFirestore)(app);
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
    let registryRef = firestore.collection("accountUidRegistry").doc(candidateUid);
    let registrySnap = await tx.get(registryRef);
    while (registrySnap.exists) {
      nextNumber++;
      candidateUid = `${prefix}${nextNumber}`;
      registryRef = firestore.collection("accountUidRegistry").doc(candidateUid);
      registrySnap = await tx.get(registryRef);
    }
    tx.set(
      counterRef,
      {
        currentNumber: nextNumber,
        prefix,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedBy: "system_provisioner"
      },
      { merge: true }
    );
    tx.set(registryRef, {
      accountUid: candidateUid,
      firebaseUid: candidateUid,
      status: "reserved",
      allocatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return candidateUid;
  });
  return allocatedUid;
}
async function handleAuthProvisionUser(req, res) {
  if (req.method === "OPTIONS") {
    sendJson3(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson3(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const body = await parseBody3(req);
  const { fullName, dob, email, phone, password } = body;
  const cleanName = typeof fullName === "string" ? fullName.trim() : "";
  if (cleanName.length < 3) {
    sendJson3(res, { error: "Full Name must contain at least 3 letters." }, 400);
    return;
  }
  if (!dob || typeof dob !== "string") {
    sendJson3(res, { error: "Date of Birth is required." }, 400);
    return;
  }
  const birthDate = new Date(dob);
  const today = /* @__PURE__ */ new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
    age--;
  }
  if (isNaN(age) || age < 18) {
    sendJson3(res, { error: "You must be at least 18 years old." }, 400);
    return;
  }
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!cleanEmail.endsWith("@gmail.com") || !/^[a-zA-Z0-9.]+@gmail\.com$/.test(cleanEmail)) {
    sendJson3(res, { error: "Only valid personal Gmail addresses (@gmail.com) are allowed." }, 400);
    return;
  }
  let cleanPhone = typeof phone === "string" ? phone.replace(/[\s\-\(\)]/g, "") : "";
  if (!cleanPhone.startsWith("+91")) {
    if (cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone)) {
      cleanPhone = `+91${cleanPhone}`;
    } else {
      sendJson3(res, { error: "Enter a valid 10-digit Indian mobile number." }, 400);
      return;
    }
  }
  if (!/^\+91[6-9]\d{9}$/.test(cleanPhone)) {
    sendJson3(res, { error: "Enter a valid Indian mobile number starting with 6, 7, 8, or 9." }, 400);
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    sendJson3(res, { error: "Password must be at least 8 characters long." }, 400);
    return;
  }
  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson3(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }
  const auth = (0, import_auth3.getAuth)(app);
  const firestore = (0, import_firestore3.getFirestore)(app);
  try {
    const emailIndexRef = firestore.collection("emailIndex").doc(cleanEmail);
    const emailIndexSnap = await emailIndexRef.get();
    if (emailIndexSnap.exists) {
      sendJson3(res, { error: "This Gmail address is already registered." }, 409);
      return;
    }
    const mobileIndexRef2 = firestore.collection("mobileIndex").doc(cleanPhone);
    const mobileIndexSnap = await mobileIndexRef2.get();
    if (mobileIndexSnap.exists) {
      sendJson3(res, { error: "An account with this Mobile Number is already registered." }, 409);
      return;
    }
    try {
      const existingUser = await auth.getUserByEmail(cleanEmail);
      if (existingUser) {
        sendJson3(res, { error: "This Gmail address is already registered." }, 409);
        return;
      }
    } catch (authLookupErr) {
      if (authLookupErr?.code !== "auth/user-not-found") {
        console.warn("[Auth API] Auth lookup note:", authLookupErr.message);
      }
    }
    const canonicalUid = await allocateNextSequentialUid();
    await auth.createUser({
      uid: canonicalUid,
      email: cleanEmail,
      password,
      displayName: cleanName,
      emailVerified: false,
      disabled: false
    });
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const batch = firestore.batch();
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
      updatedAt: nowIso
    });
    const pendingRegRef = firestore.collection("pendingRegistrations").doc(canonicalUid);
    batch.set(pendingRegRef, {
      uid: canonicalUid,
      email: cleanEmail,
      phone: cleanPhone,
      registrationCreatedAt: nowIso,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1e3).toISOString(),
      status: "pending_verification"
    });
    batch.set(emailIndexRef, {
      uid: canonicalUid,
      email: cleanEmail,
      createdAt: nowIso
    });
    batch.set(mobileIndexRef2, {
      uid: canonicalUid,
      phone: cleanPhone,
      createdAt: nowIso
    });
    const registryRef = firestore.collection("accountUidRegistry").doc(canonicalUid);
    batch.set(
      registryRef,
      {
        accountUid: canonicalUid,
        firebaseUid: canonicalUid,
        status: "active",
        activatedAt: nowIso
      },
      { merge: true }
    );
    const auditLogRef = firestore.collection("auditLogs").doc();
    batch.set(auditLogRef, {
      action: "USER_PROVISIONED",
      targetUid: canonicalUid,
      actorUid: "system",
      details: {
        email: cleanEmail,
        phone: cleanPhone,
        accountUid: canonicalUid
      },
      timestamp: nowIso
    });
    await batch.commit();
    const customToken = await auth.createCustomToken(canonicalUid, {
      accountUid: canonicalUid,
      role: "user"
    });
    console.log("[Auth API] Successfully provisioned canonical user:", {
      uid: canonicalUid,
      email: cleanEmail
    });
    sendJson3(res, {
      success: true,
      uid: canonicalUid,
      accountUid: canonicalUid,
      customToken,
      message: "User successfully provisioned with canonical UID."
    });
  } catch (err) {
    console.error("[Auth API] User provisioning error:", err);
    sendJson3(
      res,
      {
        success: false,
        error: err?.message || "Failed to provision user."
      },
      500
    );
  }
}
async function handleAuthProvisionGoogleUser(req, res) {
  if (req.method === "OPTIONS") {
    sendJson3(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson3(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const body = await parseBody3(req);
  const { idToken } = body;
  if (!idToken || typeof idToken !== "string") {
    sendJson3(res, { error: "Missing required idToken." }, 400);
    return;
  }
  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson3(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }
  const auth = (0, import_auth3.getAuth)(app);
  const firestore = (0, import_firestore3.getFirestore)(app);
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const googleEmail = (decoded.email || "").trim().toLowerCase();
    const googleName = decoded.name || decoded.displayName || "Google User";
    const googlePicture = decoded.picture || "";
    if (!googleEmail) {
      sendJson3(res, { error: "Google account does not contain a verified email." }, 400);
      return;
    }
    const emailIndexRef = firestore.collection("emailIndex").doc(googleEmail);
    const emailIndexSnap = await emailIndexRef.get();
    if (emailIndexSnap.exists) {
      const existingUid = emailIndexSnap.data()?.uid;
      if (existingUid) {
        const customToken = await auth.createCustomToken(existingUid);
        sendJson3(res, {
          success: true,
          uid: existingUid,
          customToken,
          isNew: false
        });
        return;
      }
    }
    sendJson3(
      res,
      {
        success: false,
        error: "Please register first. This Google account is not registered with LinkCloud.",
        code: "ACCOUNT_NOT_REGISTERED"
      },
      403
    );
    return;
  } catch (err) {
    console.error("[Auth API] Google provision error:", err);
    sendJson3(res, { success: false, error: err?.message || "Failed to provision Google account." }, 500);
  }
}
async function handleAuthProvisionPhoneUser(req, res) {
  if (req.method === "OPTIONS") {
    sendJson3(res, {}, 204);
    return;
  }
  if (req.method !== "POST") {
    sendJson3(res, { error: "Method not allowed. Use POST." }, 405);
    return;
  }
  const body = await parseBody3(req);
  const { idToken } = body;
  if (!idToken || typeof idToken !== "string") {
    sendJson3(res, { error: "Missing required idToken." }, 400);
    return;
  }
  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson3(res, { error: "Server authentication service unavailable." }, 503);
    return;
  }
  const auth = (0, import_auth3.getAuth)(app);
  const firestore = (0, import_firestore3.getFirestore)(app);
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const phoneNumber = (decoded.phone_number || "").trim();
    if (!phoneNumber) {
      sendJson3(res, { error: "Phone number not verified in authentication token." }, 400);
      return;
    }
    let mobileIndexSnap = await firestore.collection("mobileIndex").doc(phoneNumber).get();
    if (!mobileIndexSnap.exists && phoneNumber.startsWith("+91")) {
      mobileIndexSnap = await firestore.collection("mobileIndex").doc(phoneNumber.slice(3)).get();
    }
    if (!mobileIndexSnap.exists && !phoneNumber.startsWith("+")) {
      mobileIndexSnap = await firestore.collection("mobileIndex").doc(`+91${phoneNumber}`).get();
    }
    if (mobileIndexSnap.exists) {
      const existingData = mobileIndexSnap.data() || {};
      const existingUid = existingData.uid;
      if (existingUid) {
        const customToken2 = await auth.createCustomToken(existingUid);
        sendJson3(res, {
          success: true,
          uid: existingUid,
          accountUid: existingData.accountUid || existingUid,
          customToken: customToken2,
          isNew: false
        });
        return;
      }
    }
    const canonicalUid = await allocateNextSequentialUid();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (decoded.uid && decoded.uid !== canonicalUid) {
      try {
        await auth.deleteUser(decoded.uid);
      } catch (delErr) {
        console.warn("[Auth API] Temporary phone user cleanup note:", delErr.message);
      }
    }
    try {
      await auth.createUser({
        uid: canonicalUid,
        phoneNumber,
        displayName: `User ${phoneNumber.slice(-4)}`,
        disabled: false
      });
    } catch (createErr) {
      console.warn("[Auth API] Phone createUser note:", createErr.message);
    }
    const batch = firestore.batch();
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
      updatedAt: nowIso
    });
    batch.set(mobileIndexRef, {
      uid: canonicalUid,
      phone: phoneNumber,
      createdAt: nowIso
    });
    const registryRef = firestore.collection("accountUidRegistry").doc(canonicalUid);
    batch.set(
      registryRef,
      {
        accountUid: canonicalUid,
        firebaseUid: canonicalUid,
        status: "active",
        activatedAt: nowIso
      },
      { merge: true }
    );
    const auditLogRef = firestore.collection("auditLogs").doc();
    batch.set(auditLogRef, {
      action: "USER_PROVISIONED_PHONE",
      targetUid: canonicalUid,
      actorUid: "system",
      details: { phone: phoneNumber },
      timestamp: nowIso
    });
    await batch.commit();
    const customToken = await auth.createCustomToken(canonicalUid, {
      accountUid: canonicalUid,
      role: "user"
    });
    sendJson3(res, {
      success: true,
      uid: canonicalUid,
      accountUid: canonicalUid,
      customToken,
      isNew: true
    });
  } catch (err) {
    console.error("[Auth API] Phone provision error:", err);
    sendJson3(res, { success: false, error: err?.message || "Failed to provision phone account." }, 500);
  }
}
var devRateLimitMap = /* @__PURE__ */ new Map();
var DEV_RATE_LIMIT_WINDOW_MS = 60 * 1e3;
var DEV_MAX_REQUESTS_PER_WINDOW = 20;
function isDevRateLimited(ip) {
  const now = Date.now();
  const record = devRateLimitMap.get(ip);
  if (!record || record.resetAt <= now) {
    devRateLimitMap.set(ip, { count: 1, resetAt: now + DEV_RATE_LIMIT_WINDOW_MS });
    if (devRateLimitMap.size > 1e3) {
      for (const [key, val] of devRateLimitMap.entries()) {
        if (val.resetAt <= now) devRateLimitMap.delete(key);
      }
    }
    return false;
  }
  record.count++;
  return record.count > DEV_MAX_REQUESTS_PER_WINDOW;
}
async function handleAuthCheckRegistration(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson3(res, { error: "Method not allowed" }, 405);
    return;
  }
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "local";
  if (isDevRateLimited(clientIp)) {
    sendJson3(res, { error: "Too many registration checks. Please try again later." }, 429);
    return;
  }
  try {
    const body = await parseBody3(req);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.endsWith("@gmail.com")) {
      sendJson3(res, { error: "Please provide a valid Gmail address." }, 400);
      return;
    }
    const app = getFirebaseAdminApp();
    if (!app) {
      sendJson3(res, { error: "Firebase Admin not initialized" }, 500);
      return;
    }
    const firestore = (0, import_firestore3.getFirestore)(app);
    const emailIndexRef = firestore.collection("emailIndex").doc(email);
    const emailIndexSnap = await emailIndexRef.get();
    if (!emailIndexSnap.exists) {
      sendJson3(res, { registered: false, verified: false });
      return;
    }
    const indexData = emailIndexSnap.data();
    if (!indexData?.uid || indexData.status === "deleted") {
      sendJson3(res, { registered: false, verified: false });
      return;
    }
    const userSnap = await firestore.collection("users").doc(indexData.uid).get();
    const userData = userSnap.data();
    const isVerified = Boolean(userData?.emailVerified === true || userData?.status === "active");
    sendJson3(res, {
      registered: true,
      verified: isVerified
    });
  } catch (err) {
    console.warn("[Auth API] check registration notice:", err);
    sendJson3(res, { error: "Failed to check registration status" }, 500);
  }
}

// server.ts
function getDirname() {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  return process.cwd();
}
var serverDir = getDirname();
var PORT = parseInt(process.env.PORT || process.env.APP_PORT || "3000", 10);
var HOST = "0.0.0.0";
var possibleDistDirs = [
  import_node_path.default.resolve(serverDir, "dist"),
  import_node_path.default.resolve(serverDir, "artifacts/linkcloud/dist"),
  import_node_path.default.resolve(process.cwd(), "dist"),
  import_node_path.default.resolve(process.cwd(), "artifacts/linkcloud/dist"),
  "/dist",
  serverDir
];
var DIST_DIR = possibleDistDirs[0];
for (const dir of possibleDistDirs) {
  if (import_node_fs.default.existsSync(dir) && import_node_fs.default.existsSync(import_node_path.default.join(dir, "index.html"))) {
    DIST_DIR = dir;
    break;
  }
}
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};
function serveStaticFile(reqPath, res) {
  const safePath = import_node_path.default.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = import_node_path.default.join(DIST_DIR, safePath);
  if (!import_node_fs.default.existsSync(filePath)) {
    const cwdDist = import_node_path.default.join(process.cwd(), "dist", safePath);
    const cwdRoot = import_node_path.default.join(process.cwd(), safePath);
    if (import_node_fs.default.existsSync(cwdDist)) filePath = cwdDist;
    else if (import_node_fs.default.existsSync(cwdRoot)) filePath = cwdRoot;
  }
  if (import_node_fs.default.existsSync(filePath) && import_node_fs.default.statSync(filePath).isDirectory()) {
    filePath = import_node_path.default.join(filePath, "index.html");
  }
  if (import_node_fs.default.existsSync(filePath) && import_node_fs.default.statSync(filePath).isFile()) {
    const ext = import_node_path.default.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const isImmutable = safePath.startsWith("/assets/") || safePath.startsWith("assets/");
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    if (isImmutable) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (ext === ".html" || ext === ".htm") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
    const stream = import_node_fs.default.createReadStream(filePath);
    stream.pipe(res);
    return true;
  }
  return false;
}
var server = import_node_http.default.createServer(async (req, res) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname;
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return;
  }
  if (pathname === "/health" || pathname === "/__health" || pathname === "/_health" || pathname === "/__aistudio_health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
    return;
  }
  try {
    if (pathname === "/api/announcements") {
      return handleAnnouncementsGetRequest(req, res);
    }
    if (pathname === "/api/admin/announcements") {
      if (req.method === "GET") {
        return handleAdminAnnouncementsListRequest(req, res);
      }
      if (req.method === "POST") {
        return handleAdminAnnouncementCreateRequest(req, res);
      }
      if (req.method === "PUT" || req.method === "PATCH") {
        return handleAdminAnnouncementUpdateRequest(req, res);
      }
      if (req.method === "DELETE") {
        return handleAdminAnnouncementDeleteRequest(req, res);
      }
    }
    if (pathname === "/api/admin/settings") {
      if (req.method === "GET") {
        return handleAdminSettingsGetRequest(req, res);
      }
      return handleAdminSettingsUpdateRequest(req, res);
    }
    if (pathname === "/api/admin/users/status") {
      return handleAdminUserStatusRequest(req, res);
    }
    if (pathname === "/api/admin/users/delete") {
      return handleAdminUserDeleteRequest(req, res);
    }
    if (pathname === "/api/admin/stats") {
      return handleAdminStatsRequest(req, res);
    }
    if (pathname === "/api/admin/migration/dry-run") {
      return handleAdminMigrationDryRunRequest(req, res);
    }
    if (pathname === "/api/admin/cleanup-unverified") {
      return handleAdminCleanupUnverifiedRequest(req, res);
    }
    if (pathname === "/api/auth/check-registration") {
      return handleAuthCheckRegistration(req, res);
    }
    if (pathname === "/api/auth/provision-user") {
      return handleAuthProvisionUser(req, res);
    }
    if (pathname === "/api/auth/provision-google-user") {
      return handleAuthProvisionGoogleUser(req, res);
    }
    if (pathname === "/api/auth/provision-phone-user") {
      return handleAuthProvisionPhoneUser(req, res);
    }
    if (pathname === "/api/email-change/request") {
      return handleDevEmailChangeRequest(req, res);
    }
    if (pathname === "/api/email-change/resend") {
      return handleDevEmailChangeResend(req, res);
    }
    if (pathname === "/api/email-change/verify") {
      return handleDevEmailChangeVerify(req, res);
    }
    if (pathname === "/api/email-change/session-refresh") {
      return handleDevEmailChangeSessionRefresh(req, res);
    }
    if (pathname === "/api/email-change/cancel") {
      return handleDevEmailChangeCancel(req, res);
    }
    if (pathname.startsWith("/api/")) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Endpoint not found", path: pathname }));
      return;
    }
  } catch (err) {
    console.error(`[Server API Error] ${req.method} ${pathname}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error", message: err?.message || String(err) }));
    }
    return;
  }
  const served = serveStaticFile(pathname, res);
  if (served) {
    return;
  }
  if (import_node_path.default.extname(pathname)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.end("Not Found");
    return;
  }
  const possibleIndexPaths = [
    import_node_path.default.join(DIST_DIR, "index.html"),
    import_node_path.default.join(process.cwd(), "dist", "index.html"),
    import_node_path.default.join(process.cwd(), "index.html")
  ];
  let foundIndexPath = null;
  for (const p of possibleIndexPaths) {
    if (import_node_fs.default.existsSync(p)) {
      foundIndexPath = p;
      break;
    }
  }
  if (foundIndexPath) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    import_node_fs.default.createReadStream(foundIndexPath).pipe(res);
  } else {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!DOCTYPE html><html><head><title>LinkCloud</title></head><body><div id="root"></div></body></html>');
  }
});
server.on("error", (err) => {
  console.error("[LinkCloud Server Error]", err);
});
server.listen(PORT, HOST, () => {
  console.log(`[LinkCloud Server] Running on http://${HOST}:${PORT}`);
  console.log(`[LinkCloud Server] Serving static files from: ${DIST_DIR}`);
});
if (PORT !== 3e3) {
  try {
    const secondaryServer = import_node_http.default.createServer((req, res) => {
      server.emit("request", req, res);
    });
    secondaryServer.on("error", (err) => {
      console.log(`[LinkCloud Server] Port 3000 secondary listener notice: ${err.message}`);
    });
    secondaryServer.listen(3e3, HOST, () => {
      console.log(`[LinkCloud Server] Also listening on secondary port http://${HOST}:3000`);
    });
  } catch (secErr) {
    console.log("[LinkCloud Server] Secondary port setup note:", secErr);
  }
}
process.on("SIGTERM", () => {
  console.log("[LinkCloud Server] Received SIGTERM, shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
process.on("SIGINT", () => {
  console.log("[LinkCloud Server] Received SIGINT, shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
