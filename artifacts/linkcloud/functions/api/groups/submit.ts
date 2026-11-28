import {
  getGroupLimits,
  MIN_GROUP_DESCRIPTION_LENGTH,
  parseAndValidateTags,
} from "../../../src/lib/group-validation";
import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import { getServiceAccount, verifyFirebaseIdToken } from "../email-change/_firebase-admin";
import {
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreRunQueryField,
} from "../email-change/_firestore";
import { handleAdminFirestoreError } from "../admin/_admin-common";

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

function generateDocId(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${Date.now().toString(36)}_${hex}`;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // 1. Strict authentication required — visitors/guests can NEVER submit a group
  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    return errorResponse("Authentication required. Please sign in to submit a group.", 401);
  }

  let decoded: { uid: string; email?: string };
  try {
    decoded = await verifyFirebaseIdToken(idToken, env);
  } catch {
    return errorResponse("Invalid or expired session. Please sign in again to submit a group.", 401);
  }

  const serviceAccount = getServiceAccount(env);
  if (!serviceAccount) {
    return errorResponse("Group submission service is temporarily unavailable.", 503);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  const uid = decoded.uid;

  try {
    // 2. Check Webmaster status & active account status
    const [webmasterDoc, userDoc, siteSettings] = await Promise.all([
      firestoreGetDoc(`webmaster/${uid}`, env),
      firestoreGetDoc(`users/${uid}`, env),
      firestoreGetDoc("settings/site", env),
    ]);

    const isWebmaster = Boolean(
      uid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" ||
        userDoc?.role === "webmaster" ||
        (webmasterDoc && webmasterDoc.active !== false)
    );

    if (
      userDoc &&
      (userDoc.status === "suspended" ||
        userDoc.status === "banned" ||
        userDoc.status === "deleted" ||
        userDoc.suspended === true ||
        userDoc.banned === true)
    ) {
      return errorResponse("Your account is restricted from submitting groups.", 403);
    }

    // 3. Enforce Webmaster groupSubmissionEnabled toggle (fail-closed for non-Webmasters)
    if (!isWebmaster) {
      if (!siteSettings || typeof siteSettings !== "object" || siteSettings.groupSubmissionEnabled !== true) {
        return errorResponse("Link submissions are temporarily paused by Webmaster.", 403);
      }
    }

    const limits = getGroupLimits(siteSettings);

    // 4. Validate required fields & configurable character/tag rules
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const tagline = typeof body.tagline === "string" ? body.tagline.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim() : "";
    const contentType = typeof body.contentType === "string" && body.contentType.trim() ? body.contentType.trim() : "General Discussion";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const language = typeof body.language === "string" && body.language.trim() ? body.language.trim() : "Hindi";
    const state = typeof body.state === "string" ? body.state.trim() : "";
    const district = typeof body.district === "string" ? body.district.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const rules = typeof body.rules === "string" ? body.rules.trim() : "";
    const minimumAge = typeof body.minimumAge === "string" && body.minimumAge.trim() ? body.minimumAge.trim() : "All Ages";
    const joinUrl = typeof body.joinUrl === "string" ? body.joinUrl.trim() : "";
    const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";

    if (name.length < 3 || name.length > limits.nameMaxLength) {
      return errorResponse(`Group Name must be between 3 and ${limits.nameMaxLength} characters.`, 400);
    }
    if (tagline.length > limits.taglineMaxLength) {
      return errorResponse(`Short Tagline must not exceed ${limits.taglineMaxLength} characters.`, 400);
    }
    if (!platform || platform.length > 60) {
      return errorResponse("Platform is required.", 400);
    }
    if (!categoryId || categoryId.length > 128) {
      return errorResponse("Category is required.", 400);
    }
    if (description.length < MIN_GROUP_DESCRIPTION_LENGTH) {
      return errorResponse(`Description must be at least ${MIN_GROUP_DESCRIPTION_LENGTH} characters.`, 400);
    }
    if (description.length > limits.descriptionMaxLength) {
      return errorResponse(`Description must not exceed ${limits.descriptionMaxLength} characters.`, 400);
    }
    if (!state || !district || !city) {
      return errorResponse("State, District, and City are required.", 400);
    }
    if (!joinUrl || joinUrl.length > 500 || !/^https?:\/\/.+/i.test(joinUrl)) {
      return errorResponse("A valid HTTP/HTTPS Invite Link is required.", 400);
    }
    if (rules.length > limits.rulesMaxLength) {
      return errorResponse(`Rules must not exceed ${limits.rulesMaxLength} characters.`, 400);
    }
    if (logoUrl.length > 1000) {
      return errorResponse("Logo URL exceeds maximum allowed length.", 400);
    }
    if (limits.requireGroupLogo && !logoUrl) {
      return errorResponse("Group Logo is required by Webmaster settings.", 400);
    }

    const tagsResult = parseAndValidateTags(body.tags, {
      required: true,
      maxTags: limits.maxTags,
    });
    if (!tagsResult.valid) {
      return errorResponse(tagsResult.error || "Invalid group tags.", 400);
    }

    // 5. Duplicate invite link check
    const existingByUrl = await firestoreRunQueryField("groups", "joinUrl", "EQUAL", joinUrl, env, 1);
    if (existingByUrl.length > 0) {
      return errorResponse("This Invite Link has already been submitted to LinkCloud.", 409);
    }

    const groupId = generateDocId("grp");
    const nowIso = new Date().toISOString();
    const safeStatus =
      (isWebmaster && body.status === "approved") || limits.autoApproveGroups
        ? "approved"
        : "pending";
    const submitterName = String(
      userDoc?.displayName || body.submittedByName || decoded.email || "User"
    ).slice(0, 100);
    const submitterEmail = String(userDoc?.email || decoded.email || "").slice(0, 150);

    // 6. Create public group document (no submitter PII) + protected /groupOwnership
    await firestoreSetDoc(
      `groups/${groupId}`,
      {
        name,
        tagline,
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
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      env,
      false
    );

    await firestoreSetDoc(
      `groupOwnership/${groupId}`,
      {
        groupId,
        submittedBy: uid,
        submitterUid: uid,
        ownerUid: uid,
        submittedByName: submitterName,
        submittedByEmail: submitterEmail,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      env,
      false
    ).catch((ownErr) => {
      console.warn("[Cloudflare Groups] Ownership doc creation warning:", ownErr?.message);
    });

    return jsonResponse({
      success: true,
      id: groupId,
      groupId,
      status: safeStatus,
    });
  } catch (err: any) {
    console.error("[Cloudflare Groups] Group submission error:", err?.message || "unexpected");
    return handleAdminFirestoreError(err, "Failed to submit group. Please try again.");
  }
}
