import type { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import { getFirebaseAdminApp } from "./admin-api.ts";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  MAX_GROUP_DESCRIPTION_LENGTH,
  MIN_GROUP_DESCRIPTION_LENGTH,
  parseAndValidateTags,
  validateReportPayload,
} from "../lib/group-validation.ts";

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

function getBearerToken(req: IncomingMessage): string {
  const authHeader = String(req.headers.authorization || "");
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

// Process-local sliding-window rate limiting maps for Node dev server.
// Note: Equivalent Cloudflare Pages Functions enforce isolate-local limits on edge.
const ipReportRateMap = new Map<string, { count: number; resetAt: number }>();
const groupCooldownMap = new Map<string, number>();

const REPORT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REPORTS_PER_IP = 10;
const DUPLICATE_GROUP_COOLDOWN_MS = 10 * 60 * 1000;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipReportRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipReportRateMap.set(ip, { count: 1, resetAt: now + REPORT_WINDOW_MS });
    if (ipReportRateMap.size > 2000) {
      for (const [k, v] of ipReportRateMap.entries()) {
        if (v.resetAt <= now) ipReportRateMap.delete(k);
      }
    }
    return true;
  }
  if (entry.count >= MAX_REPORTS_PER_IP) return false;
  entry.count++;
  return true;
}

function checkDuplicateCooldown(key: string): boolean {
  const now = Date.now();
  const expiresAt = groupCooldownMap.get(key);
  if (expiresAt && expiresAt > now) {
    return false;
  }
  groupCooldownMap.set(key, now + DUPLICATE_GROUP_COOLDOWN_MS);
  if (groupCooldownMap.size > 2000) {
    for (const [k, v] of groupCooldownMap.entries()) {
      if (v <= now) groupCooldownMap.delete(k);
    }
  }
  return true;
}

export async function handleGroupSubmitRequest(
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

  const idToken = getBearerToken(req);
  if (!idToken) {
    sendJson(res, { success: false, error: "Authentication required. Please sign in to submit a group." }, 401);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { success: false, error: "Group submission service is temporarily unavailable." }, 503);
    return;
  }

  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);

  let decoded: { uid: string; email?: string };
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    sendJson(res, { success: false, error: "Invalid or expired session. Please sign in again to submit a group." }, 401);
    return;
  }

  const body = await parseBody(req);
  const uid = decoded.uid;

  try {
    const [webmasterSnap, userSnap, siteSnap] = await Promise.all([
      firestore.collection("webmaster").doc(uid).get(),
      firestore.collection("users").doc(uid).get(),
      firestore.doc("settings/site").get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() || {} : null;
    const webmasterData = webmasterSnap.exists ? webmasterSnap.data() || {} : null;
    const siteSettings = siteSnap.exists ? siteSnap.data() || {} : null;

    const isWebmaster = Boolean(
      uid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
        userData?.role === "webmaster" ||
        (webmasterData && webmasterData.active !== false)
    );

    if (
      userData &&
      (userData.status === "suspended" ||
        userData.status === "banned" ||
        userData.status === "deleted" ||
        userData.suspended === true ||
        userData.banned === true)
    ) {
      sendJson(res, { success: false, error: "Your account is restricted from submitting groups." }, 403);
      return;
    }

    if (!isWebmaster) {
      if (!siteSettings || typeof siteSettings !== "object" || siteSettings.groupSubmissionEnabled !== true) {
        sendJson(res, { success: false, error: "Link submissions are temporarily paused by Webmaster." }, 403);
        return;
      }
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim() : "";
    const contentType =
      typeof body.contentType === "string" && body.contentType.trim()
        ? body.contentType.trim()
        : "General Discussion";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const language =
      typeof body.language === "string" && body.language.trim() ? body.language.trim() : "Hindi";
    const state = typeof body.state === "string" ? body.state.trim() : "";
    const district = typeof body.district === "string" ? body.district.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const rules = typeof body.rules === "string" ? body.rules.trim() : "";
    const minimumAge =
      typeof body.minimumAge === "string" && body.minimumAge.trim()
        ? body.minimumAge.trim()
        : "All Ages";
    const joinUrl = typeof body.joinUrl === "string" ? body.joinUrl.trim() : "";
    const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";

    if (name.length < 3 || name.length > 100) {
      sendJson(res, { success: false, error: "Group Name must be between 3 and 100 characters." }, 400);
      return;
    }
    if (!platform || platform.length > 60) {
      sendJson(res, { success: false, error: "Platform is required." }, 400);
      return;
    }
    if (!categoryId || categoryId.length > 128) {
      sendJson(res, { success: false, error: "Category is required." }, 400);
      return;
    }
    if (description.length < MIN_GROUP_DESCRIPTION_LENGTH) {
      sendJson(
        res,
        { success: false, error: `Description must be at least ${MIN_GROUP_DESCRIPTION_LENGTH} characters.` },
        400
      );
      return;
    }
    if (description.length > MAX_GROUP_DESCRIPTION_LENGTH) {
      sendJson(
        res,
        { success: false, error: `Description must not exceed ${MAX_GROUP_DESCRIPTION_LENGTH} characters.` },
        400
      );
      return;
    }
    if (!state || !district || !city) {
      sendJson(res, { success: false, error: "State, District, and City are required." }, 400);
      return;
    }
    if (!joinUrl || joinUrl.length > 500 || !/^https?:\/\/.+/i.test(joinUrl)) {
      sendJson(res, { success: false, error: "A valid HTTP/HTTPS Invite Link is required." }, 400);
      return;
    }
    if (rules.length > 1000 || logoUrl.length > 1000) {
      sendJson(res, { success: false, error: "Rules or Logo URL exceeds maximum allowed length." }, 400);
      return;
    }

    const tagsResult = parseAndValidateTags(body.tags, { required: true });
    if (!tagsResult.valid) {
      sendJson(res, { success: false, error: tagsResult.error || "Invalid group tags." }, 400);
      return;
    }

    const dupSnap = await firestore.collection("groups").where("joinUrl", "==", joinUrl).limit(1).get();
    if (!dupSnap.empty) {
      sendJson(res, { success: false, error: "This Invite Link has already been submitted to LinkCloud." }, 409);
      return;
    }

    const groupId = `grp_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
    const safeStatus = isWebmaster && body.status === "approved" ? "approved" : "pending";
    const submitterName = String(
      userData?.displayName || body.submittedByName || decoded.email || "User"
    ).slice(0, 100);
    const submitterEmail = String(userData?.email || decoded.email || "").slice(0, 150);

    const batch = firestore.batch();
    batch.set(firestore.collection("groups").doc(groupId), {
      name,
      platform,
      categoryId,
      categoryName,
      contentType,
      logoUrl,
      description,
      language,
      state,
      district,
      city,
      rules,
      minimumAge,
      tags: tagsResult.tags,
      joinUrl,
      submittedBy: uid,
      submitterUid: uid,
      status: safeStatus,
      featured: false,
      pinned: false,
      hidden: false,
      trending: false,
      viewsCount: 0,
      joinCount: 0,
      reportCount: 0,
      memberCount: 0,
      linkStatus: "Active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(firestore.collection("groupOwnership").doc(groupId), {
      groupId,
      submittedBy: uid,
      submitterUid: uid,
      ownerUid: uid,
      submittedByName: submitterName,
      submittedByEmail: submitterEmail,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    sendJson(res, {
      success: true,
      id: groupId,
      status: safeStatus,
    });
  } catch (err: any) {
    console.error("[Groups API] Submit group error:", err?.message || "unexpected");
    sendJson(res, { success: false, error: "Failed to submit group. Please try again." }, 500);
  }
}

export async function handleReportSubmitRequest(
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

  if (!checkIpRateLimit(clientIp)) {
    sendJson(res, { success: false, error: "Too many reports submitted. Please try again later." }, 429);
    return;
  }

  const body = await parseBody(req);
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  if (!groupId || groupId.length > 128) {
    sendJson(res, { success: false, error: "Valid groupId is required." }, 400);
    return;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    sendJson(res, { success: false, error: "Reporting service is temporarily unavailable." }, 503);
    return;
  }

  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);

  const idToken = getBearerToken(req);
  let authenticatedUid = "";
  let authenticatedName = "";

  if (idToken) {
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      authenticatedUid = decoded.uid;
      const userSnap = await firestore.collection("users").doc(authenticatedUid).get();
      const userData = userSnap.exists ? userSnap.data() : null;
      authenticatedName = String(
        userData?.displayName || decoded.email || "Registered User"
      ).slice(0, 100);
    } catch {
      sendJson(res, { success: false, error: "Invalid or expired authentication token." }, 401);
      return;
    }
  }

  const validation = validateReportPayload({
    isSignedIn: Boolean(authenticatedUid),
    reporterName: body.reportedByName,
    reason: body.reason,
    details: body.details,
  });

  if (!validation.valid) {
    const firstError =
      validation.errors.reporterName ||
      validation.errors.reason ||
      validation.errors.details ||
      "Please complete all required report fields.";
    sendJson(res, { success: false, error: firstError, fieldErrors: validation.errors }, 400);
    return;
  }

  try {
    const [siteSnap, groupSnap] = await Promise.all([
      firestore.doc("settings/site").get(),
      firestore.collection("groups").doc(groupId).get(),
    ]);

    const siteSettings = siteSnap.exists ? siteSnap.data() : null;
    if (siteSettings && siteSettings.reportSystemEnabled === false) {
      sendJson(res, { success: false, error: "Abuse reporting is currently disabled by the webmaster." }, 403);
      return;
    }

    if (!groupSnap.exists) {
      sendJson(res, { success: false, error: "Target group was not found." }, 404);
      return;
    }

    const cooldownKey = `${authenticatedUid || clientIp}:${groupId}`;
    if (!checkDuplicateCooldown(cooldownKey)) {
      sendJson(
        res,
        {
          success: false,
          error: "You have already reported this group recently. Please wait before submitting again.",
        },
        429
      );
      return;
    }

    const groupData = groupSnap.data() || {};
    const reportId = `rep_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;

    const batch = firestore.batch();
    batch.set(firestore.collection("reports").doc(reportId), {
      groupId,
      groupName: String(groupData.name || body.groupName || "Community Group").slice(0, 150),
      reportedBy: authenticatedUid,
      reportedByName: authenticatedUid ? authenticatedName : validation.cleanData.reporterName,
      reason: validation.cleanData.reason,
      details: validation.cleanData.details,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.update(firestore.collection("groups").doc(groupId), {
      reportCount: FieldValue.increment(1),
    });
    await batch.commit();

    sendJson(res, {
      success: true,
      id: reportId,
    });
  } catch (err: any) {
    console.error("[Reports API] Submit report error:", err?.message || "unexpected");
    sendJson(res, { success: false, error: "Failed to submit report. Please try again." }, 500);
  }
}
