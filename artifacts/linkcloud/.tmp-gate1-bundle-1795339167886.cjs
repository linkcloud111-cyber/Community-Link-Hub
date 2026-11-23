"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// artifacts/linkcloud/src/server/cms-api.ts
var cms_api_exports = {};
__export(cms_api_exports, {
  createCmsNodeHandlers: () => createCmsNodeHandlers,
  createFirebaseAdminCmsAdapter: () => createFirebaseAdminCmsAdapter,
  handleAdminCmsDeleteRequest: () => handleAdminCmsDeleteRequest,
  handleAdminCmsDraftSaveRequest: () => handleAdminCmsDraftSaveRequest,
  handleAdminCmsPagesGetRequest: () => handleAdminCmsPagesGetRequest,
  handleAdminCmsPublishRequest: () => handleAdminCmsPublishRequest,
  handleAdminCmsRefreshRequest: () => handleAdminCmsRefreshRequest,
  handleAdminCmsRestoreRequest: () => handleAdminCmsRestoreRequest,
  handleAdminCmsSeedRequest: () => handleAdminCmsSeedRequest,
  handleAdminCmsUnpublishRequest: () => handleAdminCmsUnpublishRequest,
  handleAdminCmsVersionsRequest: () => handleAdminCmsVersionsRequest,
  handleAdminFaqsRequest: () => handleAdminFaqsRequest,
  handleAdminHelpArticlesRequest: () => handleAdminHelpArticlesRequest,
  handlePublicCmsPagesGetRequest: () => handlePublicCmsPagesGetRequest,
  handlePublicFaqsGetRequest: () => handlePublicFaqsGetRequest,
  handlePublicHelpArticlesGetRequest: () => handlePublicHelpArticlesGetRequest
});
module.exports = __toCommonJS(cms_api_exports);
var import_firestore2 = require("firebase-admin/firestore");

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

// artifacts/linkcloud/src/lib/cms-schema.ts
var CMS_PAGE_SLUGS = [
  "about",
  "faq",
  "help",
  "privacy",
  "terms",
  "dmca",
  "disclaimer"
];
var LEGAL_PAGE_SLUGS = [
  "privacy",
  "terms",
  "dmca",
  "disclaimer"
];
var CMS_PAGE_ROUTES = {
  about: "/about",
  faq: "/faq",
  help: "/help",
  privacy: "/privacy",
  terms: "/terms",
  dmca: "/dmca",
  disclaimer: "/disclaimer"
};
var ALLOWED_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "bullet_list",
  "numbered_list",
  "link",
  "notice",
  "faq_item",
  "steps",
  "contact_info"
];
var KNOWN_LEGACY_PLACEHOLDERS = [
  "linkcloud respects user privacy. we do not store or inspect private chat content, messages, or member lists.",
  "by using linkcloud, users agree not to submit illegal, spam, copyrighted, or prohibited group links.",
  "to file a copyright takedown request under dmca, please email support@linkcloud.in with link details.",
  "linkcloud is a public indexing platform and is not affiliated with whatsapp, telegram, discord, meta, or google.",
  "linkcloud is india's leading verified directory for whatsapp, telegram, and discord communities."
];
function isValidCmsSlug(slug) {
  return typeof slug === "string" && CMS_PAGE_SLUGS.includes(slug);
}
function isLegalCmsSlug(slug) {
  return typeof slug === "string" && LEGAL_PAGE_SLUGS.includes(slug);
}
function getCmsRouteForSlug(slug) {
  return CMS_PAGE_ROUTES[slug];
}
function isSafeCmsUrl(rawUrl, allowMailto = false) {
  if (typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:") || lower.startsWith("file:") || lower.startsWith("//")) {
    return false;
  }
  if (trimmed.startsWith("/")) {
    return true;
  }
  if (allowMailto && lower.startsWith("mailto:")) {
    return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed);
  }
  return lower.startsWith("https://") || lower.startsWith("http://");
}
function sanitizeCmsText(raw, maxLen = 4e3) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<\/?(script|style|iframe|object|embed|svg|img|link|meta|form)[^>]*>/gi, "").replace(/\bon\w+\s*=/gi, "").trim().slice(0, maxLen);
}
function isIncompleteLegacyText(raw) {
  if (typeof raw !== "string") return false;
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return true;
  if (KNOWN_LEGACY_PLACEHOLDERS.includes(normalized)) return true;
  return normalized.length < 160 && !normalized.includes("\n");
}
function generateBlockId() {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function validateAndNormalizeCmsPageInput(raw, opts) {
  const fieldErrors = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Malformed CMS payload: Expected JSON object." };
  }
  const slug = raw.slug;
  if (!isValidCmsSlug(slug)) {
    return {
      valid: false,
      error: `Invalid CMS page slug '${String(slug || "")}'. Must be one of: ${CMS_PAGE_SLUGS.join(", ")}.`
    };
  }
  const title = sanitizeCmsText(raw.title, 140);
  if (title.length < 3) {
    fieldErrors.title = "Title must be at least 3 characters.";
  }
  const subtitle = sanitizeCmsText(raw.subtitle || "", 200);
  const description = sanitizeCmsText(raw.description || "", 400);
  if (description.length < 10) {
    fieldErrors.description = "Page summary description must be at least 10 characters.";
  }
  if (!Array.isArray(raw.blocks)) {
    fieldErrors.blocks = "Content blocks must be an array.";
  } else if (raw.blocks.length === 0) {
    fieldErrors.blocks = "At least one structured content section is required.";
  } else if (raw.blocks.length > 60) {
    fieldErrors.blocks = "Maximum 60 structured blocks allowed per CMS page.";
  }
  const normalizedBlocks = [];
  if (Array.isArray(raw.blocks)) {
    for (let i = 0; i < Math.min(raw.blocks.length, 60); i++) {
      const b = raw.blocks[i];
      if (!b || typeof b !== "object") {
        fieldErrors[`blocks.${i}`] = `Block #${i + 1} is malformed.`;
        continue;
      }
      if (!ALLOWED_BLOCK_TYPES.includes(b.type)) {
        fieldErrors[`blocks.${i}`] = `Block #${i + 1} has unsupported type '${String(b.type)}'.`;
        continue;
      }
      const id = sanitizeCmsText(b.id || generateBlockId(), 60) || generateBlockId();
      const type = b.type;
      const heading = sanitizeCmsText(b.heading || "", 180);
      const text = sanitizeCmsText(b.text || "", 4e3);
      if (type === "heading") {
        const headingText = text || heading;
        if (headingText.length < 2) {
          fieldErrors[`blocks.${i}`] = `Heading block #${i + 1} requires heading text.`;
        }
        normalizedBlocks.push({
          id,
          type,
          level: b.level === 3 ? 3 : 2,
          text: headingText
        });
      } else if (type === "paragraph") {
        if (text.length < 5) {
          fieldErrors[`blocks.${i}`] = `Paragraph block #${i + 1} requires at least 5 characters.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...heading ? { heading } : {},
          text
        });
      } else if (type === "bullet_list" || type === "numbered_list") {
        const items = Array.isArray(b.items) ? b.items.map((it) => sanitizeCmsText(String(it || ""), 500)).filter((it) => it.length > 0).slice(0, 40) : [];
        if (items.length === 0) {
          fieldErrors[`blocks.${i}`] = `List block #${i + 1} requires at least one non-empty item.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...heading ? { heading } : {},
          items
        });
      } else if (type === "link") {
        const label = sanitizeCmsText(b.label || "", 120);
        const url = typeof b.url === "string" ? b.url.trim() : "";
        if (!label) {
          fieldErrors[`blocks.${i}`] = `Link block #${i + 1} requires a link label.`;
        }
        if (!isSafeCmsUrl(url, true)) {
          fieldErrors[`blocks.${i}`] = `Link block #${i + 1} has a disallowed or invalid URL.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...heading ? { heading } : {},
          ...text ? { text } : {},
          label,
          url
        });
      } else if (type === "notice") {
        if (text.length < 5) {
          fieldErrors[`blocks.${i}`] = `Notice block #${i + 1} requires notice text.`;
        }
        const tone = ["info", "warning", "important", "legal"].includes(b.tone) ? b.tone : "info";
        normalizedBlocks.push({
          id,
          type,
          ...heading ? { heading } : {},
          tone,
          text
        });
      } else if (type === "faq_item") {
        const question = sanitizeCmsText(b.question || "", 300);
        const answer = sanitizeCmsText(b.answer || "", 3e3);
        if (question.length < 4 || answer.length < 5) {
          fieldErrors[`blocks.${i}`] = `FAQ block #${i + 1} requires both question and answer.`;
        }
        normalizedBlocks.push({ id, type, question, answer });
      } else if (type === "steps") {
        const steps = Array.isArray(b.steps) ? b.steps.map((st) => ({
          title: sanitizeCmsText(st?.title || "", 160),
          description: sanitizeCmsText(st?.description || "", 1e3)
        })).filter((st) => st.title.length > 0 && st.description.length > 0).slice(0, 25) : [];
        if (steps.length === 0) {
          fieldErrors[`blocks.${i}`] = `Steps block #${i + 1} requires at least one step with title & description.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...heading ? { heading } : {},
          steps
        });
      } else if (type === "contact_info") {
        const contactEmail = sanitizeCmsText(b.contactEmail || "", 160);
        const contactNote = sanitizeCmsText(b.contactNote || "", 600);
        if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
          fieldErrors[`blocks.${i}`] = `Contact block #${i + 1} requires a valid verified contact email.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...heading ? { heading } : {},
          contactEmail,
          ...contactNote ? { contactNote } : {}
        });
      }
    }
  }
  if (opts?.requireSubstantiveBlocks) {
    const totalChars = normalizedBlocks.reduce((acc, blk) => {
      return acc + (blk.text?.length || 0) + (blk.answer?.length || 0) + (blk.items?.join(" ").length || 0) + (blk.steps?.map((s) => `${s.title} ${s.description}`).join(" ").length || 0);
    }, 0);
    if (totalChars < 60) {
      fieldErrors.blocks = "Published page content is too short or incomplete (minimum 60 characters across blocks).";
    }
  }
  const rawSeo = raw.seo && typeof raw.seo === "object" ? raw.seo : {};
  const seoTitle = sanitizeCmsText(rawSeo.seoTitle || title, 160);
  const seoDescription = sanitizeCmsText(rawSeo.seoDescription || description, 320);
  const seoKeywords = sanitizeCmsText(rawSeo.seoKeywords || "", 400);
  const canonicalUrl = typeof rawSeo.canonicalUrl === "string" ? rawSeo.canonicalUrl.trim() : "";
  const ogTitle = sanitizeCmsText(rawSeo.ogTitle || "", 160);
  const ogDescription = sanitizeCmsText(rawSeo.ogDescription || "", 320);
  const ogImage = typeof rawSeo.ogImage === "string" ? rawSeo.ogImage.trim() : "";
  if (canonicalUrl && !isSafeCmsUrl(canonicalUrl, false)) {
    fieldErrors["seo.canonicalUrl"] = "Canonical URL must be a valid relative path or http(s) URL.";
  }
  if (ogImage && !isSafeCmsUrl(ogImage, false)) {
    fieldErrors["seo.ogImage"] = "Open Graph image URL must be a valid relative path or http(s) URL.";
  }
  const errorKeys = Object.keys(fieldErrors);
  if (errorKeys.length > 0) {
    return {
      valid: false,
      error: fieldErrors[errorKeys[0]],
      fieldErrors
    };
  }
  return {
    valid: true,
    normalized: {
      slug,
      route: getCmsRouteForSlug(slug),
      title,
      subtitle,
      description,
      blocks: normalizedBlocks,
      seo: {
        seoTitle,
        seoDescription,
        seoKeywords,
        ...canonicalUrl ? { canonicalUrl } : {},
        ...ogTitle ? { ogTitle } : {},
        ...ogDescription ? { ogDescription } : {},
        ...ogImage ? { ogImage } : {},
        noIndex: Boolean(rawSeo.noIndex)
      },
      isLegalPage: isLegalCmsSlug(slug)
    }
  };
}
function detectUnverifiedClaims(page) {
  const warnings = [];
  const combinedText = [
    page.description || "",
    ...page.blocks.map(
      (b) => [
        b.heading,
        b.text,
        b.question,
        b.answer,
        b.contactNote,
        ...b.items || [],
        ...b.steps?.map((s) => `${s.title} ${s.description}`) || []
      ].filter(Boolean).join(" ")
    )
  ].join(" ").toLowerCase();
  if (/100% secure|unhackable|guaranteed forever|military-grade encryption/.test(combinedText)) {
    warnings.push("Avoid absolute security claims (e.g. '100% secure' or 'military-grade encryption') unless verified.");
  }
  if (/\+91[\s-]?\d{4,5}[\s-]?\d{5}/.test(combinedText)) {
    warnings.push("Verify that any listed telephone/helpline number matches an active, authorized support line.");
  }
  if (/registered office:|headquarters at|suite \d+/.test(combinedText)) {
    warnings.push("Verify any physical street address against official legal registration records before publishing.");
  }
  return warnings;
}
function buildDefaultCmsSeedTemplate(slug, supportEmail = "support@linkcloud.in", nowIso = (/* @__PURE__ */ new Date()).toISOString(), actor = { uid: "system-seed", email: "webmaster@linkcloud.in" }) {
  const safeSupportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.trim()) ? supportEmail.trim() : "support@linkcloud.in";
  const baseMeta = {
    slug,
    route: getCmsRouteForSlug(slug),
    isLegalPage: isLegalCmsSlug(slug),
    // Never auto-publish legal pages or unreviewed seeded templates
    status: "draft",
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastPublishedAt: null,
    lastPublishedByUid: null,
    lastPublishedByEmail: null,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email
  };
  switch (slug) {
    case "about":
      return {
        ...baseMeta,
        title: "About LinkCloud",
        subtitle: "Public Community Discovery Directory",
        description: "Learn how LinkCloud helps visitors discover curated public community invite links across messaging platforms while giving community owners moderation and reporting tools.",
        seo: {
          seoTitle: "About Us \u2014 LinkCloud Community Directory",
          seoDescription: "Learn about LinkCloud, how community listings are submitted and reviewed, and how visitors can safely discover or report public community links.",
          seoKeywords: "about linkcloud, public community directory, group link guidelines",
          canonicalUrl: "/about",
          noIndex: false
        },
        blocks: [
          {
            id: "about_intro",
            type: "paragraph",
            heading: "What LinkCloud Is",
            text: "LinkCloud is a curated directory designed to help people discover public community links across platforms such as WhatsApp, Telegram, Discord, and other social channels organized by topic, language, and location."
          },
          {
            id: "about_scope",
            type: "bullet_list",
            heading: "How the Directory Operates",
            items: [
              "Public browsing of approved community listings without requiring account registration.",
              "Authenticated user submissions reviewed by the Webmaster before appearing publicly.",
              "Community reporting and formal complaint workflows for broken, misleading, or policy-violating links."
            ]
          },
          {
            id: "about_independence",
            type: "notice",
            heading: "Platform Independence",
            tone: "info",
            text: "LinkCloud does not host third-party chat rooms or inspect private conversations occurring inside external messaging platforms."
          },
          {
            id: "about_contact",
            type: "contact_info",
            heading: "Directory Support",
            contactEmail: safeSupportEmail,
            contactNote: "For general questions or listing assistance, use the Contact page or email our support desk."
          }
        ]
      };
    case "faq":
      return {
        ...baseMeta,
        title: "Frequently Asked Questions",
        subtitle: "Directory & Listing Help",
        description: "Common questions and answers about browsing LinkCloud, submitting community links, moderation reviews, and reporting broken or unsafe listings.",
        seo: {
          seoTitle: "Frequently Asked Questions \u2014 LinkCloud",
          seoDescription: "Answers to common questions about browsing public groups, submitting community listings, moderation checks, and safety reporting on LinkCloud.",
          seoKeywords: "linkcloud faq, submit group help, report broken group link",
          canonicalUrl: "/faq",
          noIndex: false
        },
        blocks: [
          {
            id: "faq_intro",
            type: "paragraph",
            heading: "Using This FAQ",
            text: "Published answers below explain how LinkCloud directory discovery, community submissions, and abuse reporting operate. Individual Q&A entries can be edited, reordered, or toggled in FAQ Management."
          },
          {
            id: "faq_contact_link",
            type: "link",
            heading: "Need Additional Help?",
            text: "If your question is not covered in the FAQ list below, submit a message through our Contact page.",
            label: "Contact Support Desk",
            url: "/contact"
          }
        ]
      };
    case "help":
      return {
        ...baseMeta,
        title: "Help Center",
        subtitle: "Guides & Support Documentation",
        description: "Step-by-step guides for discovering communities, submitting and managing your listings, updating account settings, and reporting policy violations.",
        seo: {
          seoTitle: "Help Center \u2014 LinkCloud Guides & Support",
          seoDescription: "Read LinkCloud Help Center articles covering community discovery, submitting links, account management, and safety reporting.",
          seoKeywords: "linkcloud help center, submit group guide, report complaint help",
          canonicalUrl: "/help",
          noIndex: false
        },
        blocks: [
          {
            id: "help_intro",
            type: "paragraph",
            heading: "Help Center Overview",
            text: "Browse published Help Center guides managed by the Webmaster for step-by-step instructions on using LinkCloud."
          },
          {
            id: "help_steps",
            type: "steps",
            heading: "Getting Support Quickly",
            steps: [
              {
                title: "Search Published Guides",
                description: "Review the Help Center articles below or search the FAQ page for answers to common directory questions."
              },
              {
                title: "Report a Specific Listing",
                description: "Open the community detail page and use the Report Group option if an invite link is invalid or violates policy."
              },
              {
                title: "Submit a Formal Grievance or Contact Request",
                description: "Use the Complaint page for urgent takedowns or the Contact page for general account inquiries."
              }
            ]
          },
          {
            id: "help_complaint_link",
            type: "link",
            heading: "Escalation & Grievance Desk",
            text: "Need to report copyright issues, abuse, or listing removal requests?",
            label: "Open Complaint Portal",
            url: "/complaint"
          }
        ]
      };
    case "privacy":
      return {
        ...baseMeta,
        title: "Privacy Policy",
        subtitle: "Draft Legal Notice \u2014 Requires Owner Review Before Publishing",
        description: "Draft Privacy Policy describing account data, community listing metadata, authentication infrastructure, and user deletion requests on LinkCloud.",
        seo: {
          seoTitle: "Privacy Policy \u2014 LinkCloud",
          seoDescription: "Review how LinkCloud handles registration details, community submissions, and account deletion requests.",
          seoKeywords: "linkcloud privacy policy, account data, community submissions",
          canonicalUrl: "/privacy",
          noIndex: false
        },
        blocks: [
          {
            id: "privacy_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "This legal draft must be reviewed and verified by the Website Owner against actual data-handling and jurisdictional obligations before publishing."
          },
          {
            id: "privacy_info",
            type: "paragraph",
            heading: "1. Information Collected",
            text: "LinkCloud collects account profile information provided during registration (such as display name, email address, and optional profile details) along with community link metadata submitted for directory review and messages sent via Contact or Complaint forms."
          },
          {
            id: "privacy_thirdparty_chats",
            type: "paragraph",
            heading: "2. External Messaging Platforms",
            text: "LinkCloud indexes public community invite links only. LinkCloud does not store, read, or monitor private chat messages or member lists inside external messaging platforms."
          },
          {
            id: "privacy_rights",
            type: "bullet_list",
            heading: "3. Account Controls & Deletion Requests",
            items: [
              "Signed-in users may review or update supported profile fields from their dashboard.",
              "Users can submit an account deletion request through dashboard settings.",
              "Questions or requests regarding account records may be sent via the Contact page or support email."
            ]
          },
          {
            id: "privacy_contact",
            type: "contact_info",
            heading: "4. Privacy Contact",
            contactEmail: safeSupportEmail,
            contactNote: "Confirm designated privacy/grievance contact details before publishing."
          }
        ]
      };
    case "terms":
      return {
        ...baseMeta,
        title: "Terms & Conditions",
        subtitle: "Draft Legal Agreement \u2014 Requires Owner Review Before Publishing",
        description: "Draft Terms and Conditions outlining permitted directory use, submission standards, moderation authority, and external link responsibilities.",
        seo: {
          seoTitle: "Terms & Conditions \u2014 LinkCloud",
          seoDescription: "Read the draft Terms and Conditions governing directory browsing, user accounts, and community link submissions on LinkCloud.",
          seoKeywords: "linkcloud terms of service, terms and conditions, submission rules",
          canonicalUrl: "/terms",
          noIndex: false
        },
        blocks: [
          {
            id: "terms_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "This Terms & Conditions draft requires explicit Website Owner review (including governing law and age/eligibility terms) before publishing."
          },
          {
            id: "terms_conduct",
            type: "bullet_list",
            heading: "1. Prohibited Submissions & Conduct",
            items: [
              "Do not submit unlawful, fraudulent, misleading, spam, or unauthorized copyrighted community links.",
              "Do not attempt unauthorized scraping, automated abuse, or bypassing directory moderation controls.",
              "Ensure submitted community titles, descriptions, and invite links accurately reflect the linked group."
            ]
          },
          {
            id: "terms_moderation",
            type: "paragraph",
            heading: "2. Directory Moderation",
            text: "LinkCloud Webmaster moderators may approve, reject, hide, or remove any community listing or suspend accounts that violate directory guidelines."
          },
          {
            id: "terms_external",
            type: "paragraph",
            heading: "3. Third-Party Groups",
            text: "External invite links lead to communities hosted on third-party platforms outside LinkCloud's control. Visitors join third-party communities at their own discretion."
          }
        ]
      };
    case "dmca":
      return {
        ...baseMeta,
        title: "DMCA & Copyright Takedown Policy",
        subtitle: "Draft Legal Notice \u2014 Requires Owner Review Before Publishing",
        description: "Draft copyright infringement reporting procedure and required notice elements for requesting removal of directory listings on LinkCloud.",
        seo: {
          seoTitle: "DMCA & Copyright Policy \u2014 LinkCloud",
          seoDescription: "Procedure for submitting a copyright infringement or listing takedown notice to LinkCloud.",
          seoKeywords: "linkcloud dmca, copyright takedown policy, report infringement",
          canonicalUrl: "/dmca",
          noIndex: false
        },
        blocks: [
          {
            id: "dmca_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "Verify designated copyright contact/agent information and applicable statutory wording before publishing."
          },
          {
            id: "dmca_elements",
            type: "numbered_list",
            heading: "Information to Include in a Takedown Notice",
            items: [
              "Identification of the copyrighted work or trademark claimed to be infringed.",
              "Exact LinkCloud listing URL or ID where the material appears.",
              "Your name and valid contact email address for follow-up.",
              "A statement explaining why the listing is unauthorized."
            ]
          },
          {
            id: "dmca_portal",
            type: "link",
            heading: "Submit Online Notice",
            text: "Copyright notices can be submitted through the Complaint portal.",
            label: "Go to Complaint Portal",
            url: "/complaint"
          },
          {
            id: "dmca_contact",
            type: "contact_info",
            heading: "Copyright Desk Email",
            contactEmail: safeSupportEmail
          }
        ]
      };
    case "disclaimer":
      return {
        ...baseMeta,
        title: "Legal Disclaimer",
        subtitle: "Draft Legal Notice \u2014 Requires Owner Review Before Publishing",
        description: "Draft disclaimer clarifying LinkCloud's role as an independent directory index and non-affiliation with third-party messaging platforms.",
        seo: {
          seoTitle: "Legal Disclaimer \u2014 LinkCloud",
          seoDescription: "Official notice clarifying LinkCloud directory scope, third-party platform non-affiliation, and external community responsibility.",
          seoKeywords: "linkcloud disclaimer, third party non affiliation notice",
          canonicalUrl: "/disclaimer",
          noIndex: false
        },
        blocks: [
          {
            id: "disc_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "Verify disclaimer scope and liability language with the Website Owner prior to publishing."
          },
          {
            id: "disc_nature",
            type: "paragraph",
            heading: "1. Directory Index Scope",
            text: "LinkCloud operates as an informational directory index of user-submitted community invite links and does not operate or host external chat rooms."
          },
          {
            id: "disc_trademarks",
            type: "paragraph",
            heading: "2. No Third-Party Endorsement",
            text: "LinkCloud is an independent directory and is not affiliated with, endorsed by, or sponsored by WhatsApp, Meta, Telegram, Discord, Google, or any other third-party platform named in directory listings."
          }
        ]
      };
  }
}
function normalizeQuestionKey(question) {
  return sanitizeCmsText(question, 300).toLowerCase().replace(/\s+/g, " ");
}
function validateFaqPayload(raw, existingFaqs, editingId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Malformed FAQ payload." };
  }
  const question = sanitizeCmsText(raw.question, 300);
  const answer = sanitizeCmsText(raw.answer, 4e3);
  const category = sanitizeCmsText(raw.category || "General", 80) || "General";
  const sortOrderRaw = Number(raw.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.max(0, Math.min(9999, Math.floor(sortOrderRaw))) : existingFaqs.length + 1;
  const enabled = raw.enabled !== false;
  const status = raw.status === "draft" ? "draft" : "published";
  if (question.length < 5) {
    return { valid: false, error: "FAQ question must be at least 5 characters." };
  }
  if (answer.length < 10) {
    return { valid: false, error: "FAQ answer must be at least 10 characters." };
  }
  const normKey = normalizeQuestionKey(question);
  const duplicate = existingFaqs.find(
    (f) => f.id !== editingId && normalizeQuestionKey(f.question) === normKey
  );
  if (duplicate) {
    return {
      valid: false,
      isDuplicate: true,
      error: `Duplicate FAQ question already exists (ID: ${duplicate.id}).`
    };
  }
  return {
    valid: true,
    cleaned: {
      question,
      answer,
      category,
      sortOrder,
      enabled,
      status
    }
  };
}
function validateHelpArticlePayload(raw, existingCount = 0) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Malformed Help Article payload." };
  }
  const title = sanitizeCmsText(raw.title, 180);
  const category = sanitizeCmsText(raw.category || "General", 80) || "General";
  const content = sanitizeCmsText(raw.content, 8e3);
  const icon = sanitizeCmsText(raw.icon || "", 60);
  const enabled = raw.enabled !== false;
  const status = raw.status === "draft" ? "draft" : "published";
  const sortOrderRaw = Number(raw.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.max(0, Math.min(9999, Math.floor(sortOrderRaw))) : existingCount + 1;
  const viewsRaw = Number(raw.views);
  const views = Number.isFinite(viewsRaw) && viewsRaw >= 0 ? Math.floor(viewsRaw) : 0;
  if (title.length < 3) {
    return { valid: false, error: "Help article title must be at least 3 characters." };
  }
  if (content.length < 10) {
    return { valid: false, error: "Help article content must be at least 10 characters." };
  }
  let steps = [];
  if (Array.isArray(raw.steps)) {
    steps = raw.steps.map((s) => sanitizeCmsText(String(s || ""), 500)).filter((s) => s.length > 0).slice(0, 30);
  }
  return {
    valid: true,
    cleaned: {
      title,
      category,
      content,
      steps,
      enabled,
      sortOrder,
      status,
      views,
      ...icon ? { icon } : {}
    }
  };
}

// artifacts/linkcloud/src/server/cms-core.ts
function makeVersionId(version, prefix = "v") {
  return `${prefix}${version}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function getLegacyTextForSlug(slug, siteSettings, staticPages) {
  switch (slug) {
    case "about": {
      const val = siteSettings?.aboutUsContent || siteSettings?.aboutDescription || "";
      return typeof val === "string" && val.trim() ? val.trim() : null;
    }
    case "privacy": {
      const val = staticPages?.privacy || siteSettings?.privacyPolicyContent || "";
      return typeof val === "string" && val.trim() ? val.trim() : null;
    }
    case "terms": {
      const val = staticPages?.terms || siteSettings?.termsContent || "";
      return typeof val === "string" && val.trim() ? val.trim() : null;
    }
    case "dmca": {
      const val = staticPages?.dmca || siteSettings?.dmcaContent || "";
      return typeof val === "string" && val.trim() ? val.trim() : null;
    }
    case "disclaimer": {
      const val = staticPages?.disclaimer || siteSettings?.disclaimerContent || "";
      return typeof val === "string" && val.trim() ? val.trim() : null;
    }
    default:
      return null;
  }
}
function buildLegacyArchiveSnapshot(slug, legacyText, nowIso) {
  return {
    slug,
    route: getCmsRouteForSlug(slug),
    title: `Legacy ${slug.toUpperCase()} Snapshot`,
    subtitle: "Archived pre-CMS placeholder content",
    description: "Preserved original legacy text captured prior to CMS migration.",
    blocks: [
      {
        id: `legacy_${slug}`,
        type: "paragraph",
        heading: "Archived Legacy Copy",
        text: legacyText.slice(0, 4e3)
      }
    ],
    seo: {
      seoTitle: `${slug.toUpperCase()} \u2014 LinkCloud`,
      seoDescription: "Preserved legacy static page record.",
      seoKeywords: slug,
      canonicalUrl: getCmsRouteForSlug(slug),
      noIndex: false
    },
    status: "draft",
    isLegalPage: isLegalCmsSlug(slug),
    version: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastPublishedAt: null,
    lastPublishedByUid: null,
    lastPublishedByEmail: null,
    updatedByUid: "legacy-archive",
    updatedByEmail: "system@linkcloud.in"
  };
}
function blocksToPlainSummary(page) {
  const parts = [];
  if (page.description) parts.push(page.description);
  for (const blk of page.blocks || []) {
    if (blk.heading) parts.push(blk.heading);
    if (blk.text) parts.push(blk.text);
    if (blk.items?.length) parts.push(blk.items.join("\n"));
    if (blk.question || blk.answer) parts.push(`${blk.question || ""}
${blk.answer || ""}`);
    if (blk.steps?.length) {
      parts.push(blk.steps.map((s) => `${s.title}: ${s.description}`).join("\n"));
    }
    if (blk.contactEmail) {
      parts.push(`${blk.contactEmail}${blk.contactNote ? ` \u2014 ${blk.contactNote}` : ""}`);
    }
  }
  return parts.join("\n\n").slice(0, 12e3);
}
async function archiveLegacyIfNeeded(storage, slug, existingVersions, actor, nowIso) {
  const maxExisting = existingVersions.reduce((max, v) => {
    const n = typeof v.version === "number" ? v.version : 0;
    return n > max ? n : max;
  }, 0);
  if (existingVersions.length > 0) {
    return { archived: false, nextVersionStart: maxExisting + 1 };
  }
  const [siteSettings, staticPages] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages")
  ]);
  const legacyText = getLegacyTextForSlug(slug, siteSettings, staticPages);
  if (!legacyText) {
    return { archived: false, nextVersionStart: 1 };
  }
  const versionId = makeVersionId(0, "vlegacy_");
  const legacyDoc = buildLegacyArchiveSnapshot(slug, legacyText, nowIso);
  const versionRecord = {
    versionId,
    slug,
    version: 0,
    statusAtSnapshot: "draft",
    snapshot: legacyDoc,
    action: "archived_legacy",
    note: "Automatic pre-CMS legacy placeholder preservation",
    restoredFromVersion: null,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: nowIso
  };
  await storage.setDoc(`cms_pages/${slug}/versions/${versionId}`, versionRecord, false);
  return { archived: true, nextVersionStart: 1 };
}
async function syncPublishedToLegacySettings(storage, page, nowIso) {
  const summary = blocksToPlainSummary(page);
  if (page.slug === "about") {
    await storage.setDoc(
      "settings/site",
      {
        aboutTitle: page.title,
        aboutDescription: page.description,
        aboutUsContent: summary,
        updatedAt: nowIso
      },
      true
    );
    return;
  }
  const siteFieldMap = {
    privacy: "privacyPolicyContent",
    terms: "termsContent",
    dmca: "dmcaContent",
    disclaimer: "disclaimerContent"
  };
  const staticFieldMap = {
    privacy: "privacy",
    terms: "terms",
    dmca: "dmca",
    disclaimer: "disclaimer"
  };
  const siteField = siteFieldMap[page.slug];
  const staticField = staticFieldMap[page.slug];
  if (siteField && staticField) {
    await Promise.all([
      storage.setDoc(
        "settings/site",
        {
          [siteField]: summary,
          updatedAt: nowIso
        },
        true
      ),
      storage.setDoc(
        "settings/staticPages",
        {
          [staticField]: summary,
          updatedAt: nowIso
        },
        true
      )
    ]);
  }
}
async function computePageOverview(storage, slug, siteSettings, staticPages) {
  const [draftRaw, publishedRaw, versionsRaw] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 100)
  ]);
  const draft = draftRaw && draftRaw.slug === slug ? draftRaw : null;
  const published = publishedRaw && publishedRaw.slug === slug && publishedRaw.status === "published" ? publishedRaw : null;
  const legacyText = getLegacyTextForSlug(slug, siteSettings, staticPages);
  const legacyIncomplete = legacyText ? isIncompleteLegacyText(legacyText) : false;
  const activeDoc = published || draft;
  let health = "missing";
  let isIncompletePlaceholder = false;
  const warnings = [];
  if (published) {
    const check = validateAndNormalizeCmsPageInput(published, {
      requireSubstantiveBlocks: true
    });
    if (!check.valid) {
      health = "incomplete";
      isIncompletePlaceholder = true;
      warnings.push(check.error || "Published page failed structural validation.");
    } else {
      health = "published";
      warnings.push(...detectUnverifiedClaims(published));
    }
  } else if (draft) {
    const check = validateAndNormalizeCmsPageInput(draft, {
      requireSubstantiveBlocks: false
    });
    if (!check.valid) {
      health = "incomplete";
      isIncompletePlaceholder = true;
      warnings.push(check.error || "Draft failed validation.");
    } else {
      health = "draft";
      warnings.push(...detectUnverifiedClaims(draft));
    }
  } else if (legacyText) {
    health = "incomplete";
    isIncompletePlaceholder = legacyIncomplete;
    warnings.push(
      legacyIncomplete ? "Only an incomplete 1-line legacy placeholder exists in settings. Run Auto Seed preview or create a structured CMS draft." : "Legacy text exists in settings, but no structured CMS page has been created yet."
    );
  } else {
    health = "missing";
  }
  return {
    slug,
    route: getCmsRouteForSlug(slug),
    isLegalPage: isLegalCmsSlug(slug),
    health,
    hasDraft: Boolean(draft),
    hasPublished: Boolean(published),
    isIncompletePlaceholder,
    legacyPlaceholderFound: Boolean(legacyText),
    legacyTextPreview: legacyText ? legacyText.slice(0, 140) : null,
    draft,
    published,
    versionCount: activeDoc ? Math.max(versionsRaw.length, activeDoc.version || 0) : versionsRaw.length,
    warnings
  };
}
async function handlePublicGetCmsPage(storage, slugRaw, options) {
  if (options?.includeDrafts === "true" || options?.includeDrafts === true) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Forbidden: Draft content cannot be requested on the public CMS endpoint."
      }
    };
  }
  if (!isValidCmsSlug(slugRaw)) {
    return {
      status: 400,
      body: {
        success: false,
        error: `Invalid CMS page slug '${String(slugRaw || "")}'.`
      }
    };
  }
  const publishedDoc = await storage.getDoc(`cms_pages/${slugRaw}`);
  if (!publishedDoc || publishedDoc.status !== "published") {
    return {
      status: 200,
      body: {
        success: true,
        published: false,
        page: null
      }
    };
  }
  const page = publishedDoc;
  return {
    status: 200,
    body: {
      success: true,
      published: true,
      page: {
        slug: page.slug,
        route: page.route || getCmsRouteForSlug(page.slug),
        title: page.title,
        subtitle: page.subtitle || "",
        description: page.description,
        blocks: Array.isArray(page.blocks) ? page.blocks : [],
        seo: page.seo,
        status: "published",
        isLegalPage: Boolean(page.isLegalPage),
        version: page.version,
        updatedAt: page.updatedAt,
        lastPublishedAt: page.lastPublishedAt || page.updatedAt
      }
    }
  };
}
async function handlePublicGetFaqs(storage) {
  const raw = await storage.listCollection("faqs", 500);
  const faqs = raw.filter((item) => item.enabled !== false && item.status !== "draft").sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)).map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    category: item.category || "General",
    enabled: true,
    sortOrder: Number(item.sortOrder) || 0,
    status: item.status || "published"
  }));
  return {
    status: 200,
    body: {
      success: true,
      faqs
    }
  };
}
async function handlePublicGetHelpArticles(storage) {
  const raw = await storage.listCollection("help_articles", 500);
  const articles = raw.filter((item) => item.enabled !== false && item.status !== "draft").sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)).map((item) => ({
    id: item.id,
    category: item.category || "General",
    title: item.title,
    content: item.content,
    steps: Array.isArray(item.steps) ? item.steps : [],
    enabled: true,
    sortOrder: Number(item.sortOrder) || 0,
    status: item.status || "published",
    views: Number(item.views) || 0,
    icon: item.icon || ""
  }));
  return {
    status: 200,
    body: {
      success: true,
      articles
    }
  };
}
async function handleAdminGetCmsPages(storage, slugRaw) {
  if (slugRaw !== void 0 && slugRaw !== null && slugRaw !== "") {
    if (!isValidCmsSlug(slugRaw)) {
      return {
        status: 400,
        body: { success: false, error: `Invalid CMS slug '${String(slugRaw)}'.` }
      };
    }
    const [siteSettings2, staticPages2] = await Promise.all([
      storage.getDoc("settings/site"),
      storage.getDoc("settings/staticPages")
    ]);
    const overview = await computePageOverview(storage, slugRaw, siteSettings2, staticPages2);
    return {
      status: 200,
      body: {
        success: true,
        page: overview,
        pages: [overview]
      }
    };
  }
  const [siteSettings, staticPages] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages")
  ]);
  const pages = await Promise.all(
    CMS_PAGE_SLUGS.map(
      (slug) => computePageOverview(storage, slug, siteSettings, staticPages)
    )
  );
  return {
    status: 200,
    body: {
      success: true,
      pages,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
}
async function handleAdminSaveCmsDraft(storage, actor, body) {
  const validation = validateAndNormalizeCmsPageInput(body, {
    requireSubstantiveBlocks: false
  });
  if (!validation.valid || !validation.normalized) {
    return {
      status: 400,
      body: {
        success: false,
        error: validation.error || "CMS validation failed.",
        fieldErrors: validation.fieldErrors || {}
      }
    };
  }
  const normalized = validation.normalized;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${normalized.slug}`),
    storage.getDoc(`cms_pages/${normalized.slug}`),
    storage.listCollection(`cms_pages/${normalized.slug}/versions`, 200)
  ]);
  const archiveRes = await archiveLegacyIfNeeded(
    storage,
    normalized.slug,
    existingVersions,
    actor,
    nowIso
  );
  const prevVersion = Math.max(
    Number(existingDraft?.version) || 0,
    Number(existingPublished?.version) || 0,
    archiveRes.nextVersionStart - 1
  );
  const nextVersion = prevVersion + 1;
  const draftDoc = {
    slug: normalized.slug,
    route: normalized.route,
    title: normalized.title,
    subtitle: normalized.subtitle,
    description: normalized.description,
    blocks: normalized.blocks,
    seo: normalized.seo,
    status: existingPublished?.status === "published" ? "published" : "draft",
    isLegalPage: normalized.isLegalPage,
    version: nextVersion,
    createdAt: existingDraft?.createdAt || existingPublished?.createdAt || nowIso,
    updatedAt: nowIso,
    lastPublishedAt: existingPublished?.lastPublishedAt || existingDraft?.lastPublishedAt || null,
    lastPublishedByUid: existingPublished?.lastPublishedByUid || existingDraft?.lastPublishedByUid || null,
    lastPublishedByEmail: existingPublished?.lastPublishedByEmail || existingDraft?.lastPublishedByEmail || null,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email
  };
  const versionId = makeVersionId(nextVersion);
  const versionRecord = {
    versionId,
    slug: normalized.slug,
    version: nextVersion,
    statusAtSnapshot: draftDoc.status,
    snapshot: draftDoc,
    action: "draft_saved",
    note: typeof body.note === "string" ? body.note.trim().slice(0, 200) : "Draft saved",
    restoredFromVersion: null,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: nowIso
  };
  await Promise.all([
    storage.setDoc(`cms_drafts/${normalized.slug}`, draftDoc, false),
    storage.setDoc(`cms_pages/${normalized.slug}/versions/${versionId}`, versionRecord, false),
    storage.addAuditLog({
      action: "CMS Draft Saved",
      details: `Saved CMS draft for '${normalized.slug}' (${normalized.route}) [v${nextVersion}]`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `cms_drafts/${normalized.slug}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: {
      success: true,
      message: `Draft saved for ${normalized.route} (v${nextVersion}).`,
      draft: draftDoc,
      versionId,
      warnings: detectUnverifiedClaims(draftDoc)
    }
  };
}
async function handleAdminPublishCmsPage(storage, actor, body) {
  if (!body || typeof body !== "object" || !isValidCmsSlug(body.slug)) {
    return {
      status: 400,
      body: { success: false, error: "Valid CMS page slug is required to publish." }
    };
  }
  const slug = body.slug;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200)
  ]);
  const sourcePayload = body.title && Array.isArray(body.blocks) ? body : existingDraft;
  if (!sourcePayload) {
    return {
      status: 404,
      body: {
        success: false,
        error: `No draft content found for '${slug}'. Save a draft before publishing.`
      }
    };
  }
  const validation = validateAndNormalizeCmsPageInput(
    { ...sourcePayload, slug },
    { requireSubstantiveBlocks: true }
  );
  if (!validation.valid || !validation.normalized) {
    return {
      status: 400,
      body: {
        success: false,
        error: validation.error || "Cannot publish incomplete CMS page.",
        fieldErrors: validation.fieldErrors || {}
      }
    };
  }
  const archiveRes = await archiveLegacyIfNeeded(
    storage,
    slug,
    existingVersions,
    actor,
    nowIso
  );
  const normalized = validation.normalized;
  const nextVersion = Math.max(
    Number(existingDraft?.version) || 0,
    Number(existingPublished?.version) || 0,
    archiveRes.nextVersionStart - 1
  ) + 1;
  const publishedDoc = {
    slug: normalized.slug,
    route: normalized.route,
    title: normalized.title,
    subtitle: normalized.subtitle,
    description: normalized.description,
    blocks: normalized.blocks,
    seo: normalized.seo,
    status: "published",
    isLegalPage: normalized.isLegalPage,
    version: nextVersion,
    createdAt: existingDraft?.createdAt || existingPublished?.createdAt || nowIso,
    updatedAt: nowIso,
    lastPublishedAt: nowIso,
    lastPublishedByUid: actor.uid,
    lastPublishedByEmail: actor.email,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email
  };
  const versionId = makeVersionId(nextVersion);
  const versionRecord = {
    versionId,
    slug,
    version: nextVersion,
    statusAtSnapshot: "published",
    snapshot: publishedDoc,
    action: "published",
    note: typeof body.note === "string" ? body.note.trim().slice(0, 200) : "Published live",
    restoredFromVersion: null,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: nowIso
  };
  await Promise.all([
    storage.setDoc(`cms_pages/${slug}`, publishedDoc, false),
    storage.setDoc(`cms_drafts/${slug}`, publishedDoc, false),
    storage.setDoc(`cms_pages/${slug}/versions/${versionId}`, versionRecord, false),
    syncPublishedToLegacySettings(storage, publishedDoc, nowIso),
    storage.addAuditLog({
      action: "CMS Page Published",
      details: `Published CMS page '${slug}' (${publishedDoc.route}) [v${nextVersion}]`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `cms_pages/${slug}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: {
      success: true,
      message: `Published ${publishedDoc.route} live (v${nextVersion}).`,
      page: publishedDoc,
      versionId,
      warnings: detectUnverifiedClaims(publishedDoc)
    }
  };
}
async function handleAdminUnpublishCmsPage(storage, actor, body) {
  if (!body || typeof body !== "object" || !isValidCmsSlug(body.slug)) {
    return {
      status: 400,
      body: { success: false, error: "Valid CMS page slug is required to unpublish." }
    };
  }
  const slug = body.slug;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200)
  ]);
  const baseDoc = existingDraft || existingPublished;
  if (!baseDoc) {
    return {
      status: 404,
      body: { success: false, error: `CMS page '${slug}' does not exist.` }
    };
  }
  const maxVer = existingVersions.reduce(
    (m, v) => Math.max(m, Number(v.version) || 0),
    Number(baseDoc.version) || 0
  );
  const nextVersion = maxVer + 1;
  const updatedDraft = {
    ...baseDoc,
    slug,
    route: getCmsRouteForSlug(slug),
    status: "draft",
    version: nextVersion,
    updatedAt: nowIso,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email
  };
  const versionId = makeVersionId(nextVersion);
  const versionRecord = {
    versionId,
    slug,
    version: nextVersion,
    statusAtSnapshot: "draft",
    snapshot: updatedDraft,
    action: "unpublished",
    note: "Unpublished from public view (moved back to draft)",
    restoredFromVersion: null,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: nowIso
  };
  await Promise.all([
    storage.setDoc(`cms_drafts/${slug}`, updatedDraft, false),
    storage.deleteDoc(`cms_pages/${slug}`),
    storage.setDoc(`cms_pages/${slug}/versions/${versionId}`, versionRecord, false),
    storage.addAuditLog({
      action: "CMS Page Unpublished",
      details: `Unpublished CMS page '${slug}' (${updatedDraft.route}) [v${nextVersion}]`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `cms_pages/${slug}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: {
      success: true,
      message: `Unpublished ${updatedDraft.route}. Public projection removed; draft & version history preserved.`,
      draft: updatedDraft
    }
  };
}
async function handleAdminDeleteCmsPage(storage, actor, body) {
  const slug = body?.slug;
  if (!isValidCmsSlug(slug)) {
    return {
      status: 400,
      body: { success: false, error: "Valid CMS page slug is required to delete." }
    };
  }
  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200)
  ]);
  if (!existingDraft && !existingPublished) {
    return {
      status: 404,
      body: { success: false, error: `CMS page '${slug}' has no draft or published record.` }
    };
  }
  const isPublished = existingPublished?.status === "published";
  if (isPublished && body?.confirmDeletePublished !== true) {
    return {
      status: 409,
      body: {
        success: false,
        requiresConfirmation: true,
        error: "Cannot delete a currently published CMS page without explicit confirmation (confirmDeletePublished: true). Consider unpublishing first."
      }
    };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const baseDoc = existingDraft || existingPublished;
  const maxVer = existingVersions.reduce(
    (m, v) => Math.max(m, Number(v.version) || 0),
    Number(baseDoc.version) || 0
  );
  const archiveVer = maxVer + 1;
  const versionId = makeVersionId(archiveVer, "vdel_");
  const versionRecord = {
    versionId,
    slug,
    version: archiveVer,
    statusAtSnapshot: isPublished ? "published" : "draft",
    snapshot: baseDoc,
    action: "deleted",
    note: "Archived prior to CMS page deletion (recoverable)",
    restoredFromVersion: null,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: nowIso
  };
  await storage.setDoc(`cms_pages/${slug}/versions/${versionId}`, versionRecord, false);
  await Promise.all([
    storage.deleteDoc(`cms_drafts/${slug}`),
    storage.deleteDoc(`cms_pages/${slug}`),
    storage.addAuditLog({
      action: "CMS Page Deleted",
      details: `Soft-deleted CMS page '${slug}' (recoverable archive saved as v${archiveVer})`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `cms_pages/${slug}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: {
      success: true,
      message: `Deleted CMS page '${slug}'. A recoverable snapshot (v${archiveVer}) remains in version history.`,
      archivedVersionId: versionId
    }
  };
}
async function handleAdminGetCmsVersions(storage, slugRaw) {
  if (!isValidCmsSlug(slugRaw)) {
    return {
      status: 400,
      body: { success: false, error: `Invalid CMS slug '${String(slugRaw || "")}'.` }
    };
  }
  const rawVersions = await storage.listCollection(`cms_pages/${slugRaw}/versions`, 200);
  const versions = rawVersions.map((v) => ({ ...v, versionId: v.versionId || v.id })).sort((a, b) => {
    const vDiff = (Number(b.version) || 0) - (Number(a.version) || 0);
    if (vDiff !== 0) return vDiff;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  return {
    status: 200,
    body: {
      success: true,
      slug: slugRaw,
      versions
    }
  };
}
async function handleAdminRestoreCmsVersion(storage, actor, body) {
  const slug = body?.slug;
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  if (!isValidCmsSlug(slug)) {
    return { status: 400, body: { success: false, error: "Valid CMS slug is required." } };
  }
  if (!versionId) {
    return { status: 400, body: { success: false, error: "versionId is required." } };
  }
  if (body?.confirmRestore !== true) {
    return {
      status: 400,
      body: {
        success: false,
        requiresConfirmation: true,
        error: "Explicit confirmation (confirmRestore: true) is required to restore a historical version."
      }
    };
  }
  const [targetVersion, existingVersions, existingPublished] = await Promise.all([
    storage.getDoc(`cms_pages/${slug}/versions/${versionId}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200),
    storage.getDoc(`cms_pages/${slug}`)
  ]);
  if (!targetVersion || !targetVersion.snapshot) {
    return {
      status: 404,
      body: { success: false, error: `Revision '${versionId}' not found for '${slug}'.` }
    };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const maxVer = existingVersions.reduce(
    (m, v) => Math.max(m, Number(v.version) || 0),
    0
  );
  const nextVersion = maxVer + 1;
  const snap = targetVersion.snapshot;
  const restoredDraft = {
    ...snap,
    slug,
    route: getCmsRouteForSlug(slug),
    status: existingPublished?.status === "published" ? "published" : "draft",
    version: nextVersion,
    updatedAt: nowIso,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
    lastPublishedAt: existingPublished?.lastPublishedAt || null,
    lastPublishedByUid: existingPublished?.lastPublishedByUid || null,
    lastPublishedByEmail: existingPublished?.lastPublishedByEmail || null
  };
  const newVersionId = makeVersionId(nextVersion);
  const newVersionRecord = {
    versionId: newVersionId,
    slug,
    version: nextVersion,
    statusAtSnapshot: restoredDraft.status,
    snapshot: restoredDraft,
    action: "restored",
    note: `Restored from v${targetVersion.version} (${versionId})`,
    restoredFromVersion: Number(targetVersion.version) || 0,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: nowIso
  };
  await Promise.all([
    storage.setDoc(`cms_drafts/${slug}`, restoredDraft, false),
    storage.setDoc(`cms_pages/${slug}/versions/${newVersionId}`, newVersionRecord, false),
    storage.addAuditLog({
      action: "CMS Version Restored",
      details: `Restored '${slug}' from v${targetVersion.version} into draft v${nextVersion}`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `cms_drafts/${slug}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: {
      success: true,
      message: `Restored v${targetVersion.version} into draft v${nextVersion} for review.`,
      draft: restoredDraft,
      versionId: newVersionId
    }
  };
}
async function handleAdminCmsAutoSeed(storage, actor, body) {
  const dryRun = body?.dryRun !== false;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const [siteSettings, staticPages] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages")
  ]);
  const supportEmail = siteSettings?.supportEmail || siteSettings?.contactEmail || "support@linkcloud.in";
  const plan = [];
  let createdCount = 0;
  let skippedCount = 0;
  let archivedLegacyCount = 0;
  for (const slug of CMS_PAGE_SLUGS) {
    const [existingDraft, existingPublished, existingVersions] = await Promise.all([
      storage.getDoc(`cms_drafts/${slug}`),
      storage.getDoc(`cms_pages/${slug}`),
      storage.listCollection(`cms_pages/${slug}/versions`, 50)
    ]);
    const legacyText = getLegacyTextForSlug(slug, siteSettings, staticPages);
    const hasExistingCms = Boolean(existingDraft || existingPublished);
    if (hasExistingCms) {
      skippedCount++;
      plan.push({
        slug,
        route: getCmsRouteForSlug(slug),
        action: "skip_existing",
        reason: existingPublished ? "Existing published CMS page preserved (never overwritten)." : "Existing CMS draft preserved (never overwritten).",
        legacyPlaceholderFound: Boolean(legacyText),
        willAutoPublish: false
      });
      continue;
    }
    plan.push({
      slug,
      route: getCmsRouteForSlug(slug),
      action: "create_draft",
      reason: isLegalCmsSlug(slug) ? "Missing CMS record; will create un-published legal draft (never auto-published)." : "Missing CMS record; will create structured draft for Webmaster review.",
      legacyPlaceholderFound: Boolean(legacyText),
      willAutoPublish: false
    });
    if (!dryRun) {
      const arch = await archiveLegacyIfNeeded(
        storage,
        slug,
        existingVersions,
        actor,
        nowIso
      );
      if (arch.archived) archivedLegacyCount++;
      const templateDoc = buildDefaultCmsSeedTemplate(
        slug,
        supportEmail,
        nowIso,
        actor
      );
      templateDoc.version = arch.nextVersionStart;
      templateDoc.status = "draft";
      const versionId = makeVersionId(templateDoc.version, "vseed_");
      const versionRecord = {
        versionId,
        slug,
        version: templateDoc.version,
        statusAtSnapshot: "draft",
        snapshot: templateDoc,
        action: "seeded",
        note: "Initial non-destructive CMS seed draft",
        restoredFromVersion: null,
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: nowIso
      };
      await Promise.all([
        storage.setDoc(`cms_drafts/${slug}`, templateDoc, false),
        storage.setDoc(`cms_pages/${slug}/versions/${versionId}`, versionRecord, false)
      ]);
      createdCount++;
    }
  }
  await storage.addAuditLog({
    action: dryRun ? "CMS Auto Seed Preview" : "CMS Auto Seed Executed",
    details: dryRun ? `Dry-run Auto Seed evaluated 7 CMS pages (${plan.filter((p) => p.action === "create_draft").length} eligible drafts, ${skippedCount} preserved)` : `Executed Auto Seed: created ${createdCount} missing drafts, preserved ${skippedCount} existing pages, archived ${archivedLegacyCount} legacy placeholders`,
    adminEmail: actor.email,
    adminUid: actor.uid,
    actorEmail: actor.email,
    actorUid: actor.uid,
    target: "cms_drafts",
    outcome: dryRun ? "dry_run" : "success",
    createdAt: nowIso,
    timestamp: nowIso
  });
  return {
    status: 200,
    body: {
      success: true,
      dryRun,
      createdCount,
      skippedCount,
      archivedLegacyCount,
      plan,
      timestamp: nowIso
    }
  };
}
async function handleAdminCmsRefresh(storage, actor) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const [siteSettings, staticPages, faqs, helpArticles] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages"),
    storage.listCollection("faqs", 500),
    storage.listCollection("help_articles", 500)
  ]);
  const pages = await Promise.all(
    CMS_PAGE_SLUGS.map(
      (slug) => computePageOverview(storage, slug, siteSettings, staticPages)
    )
  );
  const summary = {
    total: pages.length,
    published: pages.filter((p) => p.health === "published").length,
    draft: pages.filter((p) => p.health === "draft").length,
    missing: pages.filter((p) => p.health === "missing").length,
    incomplete: pages.filter((p) => p.health === "incomplete").length,
    error: pages.filter((p) => p.health === "error").length,
    faqCount: faqs.length,
    enabledFaqCount: faqs.filter((f) => f.enabled !== false && f.status !== "draft").length,
    helpArticleCount: helpArticles.length,
    enabledHelpArticleCount: helpArticles.filter(
      (a) => a.enabled !== false && a.status !== "draft"
    ).length
  };
  await storage.addAuditLog({
    action: "CMS Status Refreshed",
    details: `Rechecked CMS state: ${summary.published} published, ${summary.draft} draft, ${summary.incomplete} incomplete, ${summary.missing} missing`,
    adminEmail: actor.email,
    adminUid: actor.uid,
    actorEmail: actor.email,
    actorUid: actor.uid,
    target: "cms_pages",
    outcome: "success",
    createdAt: nowIso,
    timestamp: nowIso
  });
  return {
    status: 200,
    body: {
      success: true,
      pages,
      summary,
      timestamp: nowIso
    }
  };
}
async function handleAdminListFaqs(storage) {
  const raw = await storage.listCollection("faqs", 500);
  const faqs = raw.map((item) => ({
    ...item,
    id: item.id,
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder) || 0,
    status: item.status || "published"
  })).sort((a, b) => a.sortOrder - b.sortOrder);
  return { status: 200, body: { success: true, faqs } };
}
async function handleAdminCreateFaq(storage, actor, body) {
  const existingRaw = await storage.listCollection("faqs", 500);
  const existing = existingRaw.map((d) => d);
  const check = validateFaqPayload(body, existing);
  if (!check.valid || !check.cleaned) {
    return {
      status: check.isDuplicate ? 409 : 400,
      body: { success: false, error: check.error }
    };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const id = `faq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const faqDoc = {
    id,
    ...check.cleaned,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: actor.uid,
    updatedBy: actor.uid
  };
  await Promise.all([
    storage.setDoc(`faqs/${id}`, faqDoc, false),
    storage.addAuditLog({
      action: "FAQ Created",
      details: `Created FAQ "${faqDoc.question.slice(0, 80)}" [${faqDoc.category}]`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `faqs/${id}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 201,
    body: { success: true, id, faq: faqDoc, message: "FAQ created successfully." }
  };
}
async function handleAdminUpdateFaq(storage, actor, body) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (Array.isArray(body?.reorder)) {
    const updates = body.reorder.filter(
      (r) => typeof r?.id === "string" && Number.isFinite(Number(r?.sortOrder))
    );
    if (updates.length === 0) {
      return { status: 400, body: { success: false, error: "Valid reorder items required." } };
    }
    await Promise.all(
      updates.map(
        (u) => storage.setDoc(
          `faqs/${u.id}`,
          {
            sortOrder: Math.max(0, Math.floor(Number(u.sortOrder))),
            updatedAt: nowIso,
            updatedBy: actor.uid
          },
          true
        )
      )
    );
    await storage.addAuditLog({
      action: "FAQ Updated",
      details: `Reordered ${updates.length} FAQ items`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: "faqs",
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    });
    return { status: 200, body: { success: true, message: "FAQ order updated." } };
  }
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return { status: 400, body: { success: false, error: "FAQ ID is required." } };
  }
  const existing = await storage.getDoc(`faqs/${id}`);
  if (!existing) {
    return { status: 404, body: { success: false, error: "FAQ item not found." } };
  }
  const mergedInput = {
    question: body.question !== void 0 ? body.question : existing.question,
    answer: body.answer !== void 0 ? body.answer : existing.answer,
    category: body.category !== void 0 ? body.category : existing.category,
    sortOrder: body.sortOrder !== void 0 ? body.sortOrder : existing.sortOrder,
    enabled: body.enabled !== void 0 ? body.enabled : existing.enabled,
    status: body.status !== void 0 ? body.status : existing.status
  };
  const allFaqs = await storage.listCollection("faqs", 500);
  const check = validateFaqPayload(mergedInput, allFaqs, id);
  if (!check.valid || !check.cleaned) {
    return {
      status: check.isDuplicate ? 409 : 400,
      body: { success: false, error: check.error }
    };
  }
  const updatedDoc = {
    ...check.cleaned,
    updatedAt: nowIso,
    updatedBy: actor.uid
  };
  await Promise.all([
    storage.setDoc(`faqs/${id}`, updatedDoc, true),
    storage.addAuditLog({
      action: "FAQ Updated",
      details: `Updated FAQ "${updatedDoc.question.slice(0, 80)}" (enabled: ${updatedDoc.enabled}, order: ${updatedDoc.sortOrder})`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `faqs/${id}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: {
      success: true,
      faq: { id, ...updatedDoc },
      message: "FAQ updated successfully."
    }
  };
}
async function handleAdminDeleteFaq(storage, actor, idRaw) {
  const id = typeof idRaw === "string" ? idRaw.trim() : "";
  if (!id) {
    return { status: 400, body: { success: false, error: "FAQ ID is required." } };
  }
  const existing = await storage.getDoc(`faqs/${id}`);
  if (!existing) {
    return { status: 404, body: { success: false, error: "FAQ item not found." } };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    storage.deleteDoc(`faqs/${id}`),
    storage.addAuditLog({
      action: "FAQ Deleted",
      details: `Deleted FAQ "${String(existing.question || id).slice(0, 80)}"`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `faqs/${id}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return { status: 200, body: { success: true, message: "FAQ deleted successfully." } };
}
async function handleAdminListHelpArticles(storage) {
  const raw = await storage.listCollection("help_articles", 500);
  const articles = raw.map((item) => ({
    ...item,
    id: item.id,
    steps: Array.isArray(item.steps) ? item.steps : [],
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder) || 0,
    status: item.status || "published"
  })).sort((a, b) => a.sortOrder - b.sortOrder);
  return { status: 200, body: { success: true, articles } };
}
async function handleAdminCreateHelpArticle(storage, actor, body) {
  const existing = await storage.listCollection("help_articles", 500);
  const check = validateHelpArticlePayload(body, existing.length);
  if (!check.valid || !check.cleaned) {
    return { status: 400, body: { success: false, error: check.error } };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const id = `help_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const docData = {
    id,
    ...check.cleaned,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: actor.uid,
    updatedBy: actor.uid
  };
  await Promise.all([
    storage.setDoc(`help_articles/${id}`, docData, false),
    storage.addAuditLog({
      action: "Help Article Created",
      details: `Created Help Article "${docData.title.slice(0, 80)}" [${docData.category}]`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `help_articles/${id}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 201,
    body: {
      success: true,
      id,
      article: docData,
      message: "Help article created successfully."
    }
  };
}
async function handleAdminUpdateHelpArticle(storage, actor, body) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (Array.isArray(body?.reorder)) {
    const updates = body.reorder.filter(
      (r) => typeof r?.id === "string" && Number.isFinite(Number(r?.sortOrder))
    );
    if (updates.length === 0) {
      return { status: 400, body: { success: false, error: "Valid reorder items required." } };
    }
    await Promise.all(
      updates.map(
        (u) => storage.setDoc(
          `help_articles/${u.id}`,
          {
            sortOrder: Math.max(0, Math.floor(Number(u.sortOrder))),
            updatedAt: nowIso,
            updatedBy: actor.uid
          },
          true
        )
      )
    );
    await storage.addAuditLog({
      action: "Help Article Updated",
      details: `Reordered ${updates.length} Help Center articles`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: "help_articles",
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    });
    return { status: 200, body: { success: true, message: "Help article order updated." } };
  }
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return { status: 400, body: { success: false, error: "Help Article ID is required." } };
  }
  const existing = await storage.getDoc(`help_articles/${id}`);
  if (!existing) {
    return { status: 404, body: { success: false, error: "Help article not found." } };
  }
  const mergedInput = {
    title: body.title !== void 0 ? body.title : existing.title,
    category: body.category !== void 0 ? body.category : existing.category,
    content: body.content !== void 0 ? body.content : existing.content,
    steps: body.steps !== void 0 ? body.steps : existing.steps,
    enabled: body.enabled !== void 0 ? body.enabled : existing.enabled,
    sortOrder: body.sortOrder !== void 0 ? body.sortOrder : existing.sortOrder,
    status: body.status !== void 0 ? body.status : existing.status,
    views: body.views !== void 0 ? body.views : existing.views,
    icon: body.icon !== void 0 ? body.icon : existing.icon
  };
  const check = validateHelpArticlePayload(mergedInput);
  if (!check.valid || !check.cleaned) {
    return { status: 400, body: { success: false, error: check.error } };
  }
  const updateDoc = {
    ...check.cleaned,
    updatedAt: nowIso,
    updatedBy: actor.uid
  };
  await Promise.all([
    storage.setDoc(`help_articles/${id}`, updateDoc, true),
    storage.addAuditLog({
      action: "Help Article Updated",
      details: `Updated Help Article "${updateDoc.title.slice(0, 80)}" (status: ${updateDoc.status}, enabled: ${updateDoc.enabled})`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `help_articles/${id}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: {
      success: true,
      article: { id, ...updateDoc },
      message: "Help article updated successfully."
    }
  };
}
async function handleAdminDeleteHelpArticle(storage, actor, idRaw) {
  const id = typeof idRaw === "string" ? idRaw.trim() : "";
  if (!id) {
    return { status: 400, body: { success: false, error: "Help Article ID is required." } };
  }
  const existing = await storage.getDoc(`help_articles/${id}`);
  if (!existing) {
    return { status: 404, body: { success: false, error: "Help article not found." } };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    storage.deleteDoc(`help_articles/${id}`),
    storage.addAuditLog({
      action: "Help Article Deleted",
      details: `Deleted Help Article "${String(existing.title || id).slice(0, 80)}"`,
      adminEmail: actor.email,
      adminUid: actor.uid,
      actorEmail: actor.email,
      actorUid: actor.uid,
      target: `help_articles/${id}`,
      outcome: "success",
      createdAt: nowIso,
      timestamp: nowIso
    })
  ]);
  return {
    status: 200,
    body: { success: true, message: "Help article deleted successfully." }
  };
}

// artifacts/linkcloud/src/server/cms-api.ts
function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
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
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(null);
      }
    });
  });
}
function parseQuery(req) {
  const rawUrl = req.url || "/";
  const idx = rawUrl.indexOf("?");
  return new URLSearchParams(idx >= 0 ? rawUrl.slice(idx + 1) : "");
}
function createFirebaseAdminCmsAdapter() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  const firestore = (0, import_firestore2.getFirestore)(app);
  return {
    async getDoc(path) {
      const snap = await firestore.doc(path).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() || {} };
    },
    async setDoc(path, data, merge = true) {
      if (merge) {
        await firestore.doc(path).set(data, { merge: true });
      } else {
        await firestore.doc(path).set(data);
      }
    },
    async deleteDoc(path) {
      await firestore.doc(path).delete();
    },
    async listCollection(collectionPath, limitCount = 200) {
      const snap = await firestore.collection(collectionPath).limit(limitCount).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() || {} }));
    },
    async addAuditLog(entry) {
      await firestore.collection("audit_logs").add(entry);
    }
  };
}
function createCmsNodeHandlers(deps) {
  const resolveStorage = deps?.getStorage || createFirebaseAdminCmsAdapter;
  const verifyAuth = deps?.verifyWebmaster || verifyWebmasterToken;
  async function requireAdmin(req, res) {
    const authResult = await verifyAuth(req);
    if (!authResult.valid) {
      sendJson(
        res,
        { success: false, error: authResult.error || "Unauthorized" },
        authResult.statusCode || 401
      );
      return null;
    }
    const storage = resolveStorage();
    if (!storage) {
      sendJson(
        res,
        { success: false, error: "Firestore Admin service unavailable." },
        503
      );
      return null;
    }
    return {
      actor: {
        uid: authResult.uid || "webmaster",
        email: authResult.email || "webmaster@linkcloud.in"
      },
      storage
    };
  }
  return {
    async handlePublicCmsPagesGet(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const storage = resolveStorage();
      if (!storage) {
        return sendJson(res, { success: false, error: "CMS storage unavailable." }, 503);
      }
      try {
        const params = parseQuery(req);
        const result = await handlePublicGetCmsPage(storage, params.get("slug"), {
          includeDrafts: params.get("includeDrafts")
        });
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "CMS read failed" }, 500);
      }
    },
    async handlePublicFaqsGet(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const storage = resolveStorage();
      if (!storage) {
        return sendJson(res, { success: false, error: "FAQ storage unavailable." }, 503);
      }
      try {
        const result = await handlePublicGetFaqs(storage);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to load FAQs" }, 500);
      }
    },
    async handlePublicHelpArticlesGet(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const storage = resolveStorage();
      if (!storage) {
        return sendJson(res, { success: false, error: "Help storage unavailable." }, 503);
      }
      try {
        const result = await handlePublicGetHelpArticles(storage);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(
          res,
          { success: false, error: err?.message || "Failed to load Help Center articles" },
          500
        );
      }
    },
    async handleAdminCmsPagesGet(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        const params = parseQuery(req);
        const result = await handleAdminGetCmsPages(ctx.storage, params.get("slug"));
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to load CMS pages" }, 500);
      }
    },
    async handleAdminCmsDraftSave(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "PUT" && req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use PUT or POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminSaveCmsDraft(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to save draft" }, 500);
      }
    },
    async handleAdminCmsPublish(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminPublishCmsPage(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to publish page" }, 500);
      }
    },
    async handleAdminCmsUnpublish(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminUnpublishCmsPage(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to unpublish page" }, 500);
      }
    },
    async handleAdminCmsDelete(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "DELETE" && req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use DELETE or POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const params = parseQuery(req);
      const body = await parseBody(req) || {};
      const slug = body.slug || params.get("slug");
      const confirmDeletePublished = body.confirmDeletePublished === true || params.get("confirmDeletePublished") === "true";
      try {
        const result = await handleAdminDeleteCmsPage(ctx.storage, ctx.actor, {
          slug,
          confirmDeletePublished
        });
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to delete page" }, 500);
      }
    },
    async handleAdminCmsVersions(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use GET." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        const params = parseQuery(req);
        const result = await handleAdminGetCmsVersions(ctx.storage, params.get("slug"));
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to load versions" }, 500);
      }
    },
    async handleAdminCmsRestore(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req);
      if (!body) {
        return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
      }
      try {
        const result = await handleAdminRestoreCmsVersion(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Failed to restore version" }, 500);
      }
    },
    async handleAdminCmsSeed(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      const body = await parseBody(req) || {};
      try {
        const result = await handleAdminCmsAutoSeed(ctx.storage, ctx.actor, body);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Auto Seed failed" }, 500);
      }
    },
    async handleAdminCmsRefresh(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      if (req.method !== "POST" && req.method !== "GET") {
        return sendJson(res, { success: false, error: "Method not allowed. Use POST or GET." }, 405);
      }
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        const result = await handleAdminCmsRefresh(ctx.storage, ctx.actor);
        return sendJson(res, result.body, result.status);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Refresh failed" }, 500);
      }
    },
    async handleAdminFaqs(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        if (req.method === "GET") {
          const result = await handleAdminListFaqs(ctx.storage);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "POST") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminCreateFaq(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "PUT" || req.method === "PATCH") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminUpdateFaq(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "DELETE") {
          const params = parseQuery(req);
          const body = await parseBody(req) || {};
          const id = params.get("id") || body.id;
          const result = await handleAdminDeleteFaq(ctx.storage, ctx.actor, id);
          return sendJson(res, result.body, result.status);
        }
        return sendJson(res, { success: false, error: "Method not allowed." }, 405);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "FAQ request failed" }, 500);
      }
    },
    async handleAdminHelpArticles(req, res) {
      if (req.method === "OPTIONS") return sendJson(res, {}, 204);
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;
      try {
        if (req.method === "GET") {
          const result = await handleAdminListHelpArticles(ctx.storage);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "POST") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminCreateHelpArticle(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "PUT" || req.method === "PATCH") {
          const body = await parseBody(req);
          if (!body) return sendJson(res, { success: false, error: "Invalid JSON payload." }, 400);
          const result = await handleAdminUpdateHelpArticle(ctx.storage, ctx.actor, body);
          return sendJson(res, result.body, result.status);
        }
        if (req.method === "DELETE") {
          const params = parseQuery(req);
          const body = await parseBody(req) || {};
          const id = params.get("id") || body.id;
          const result = await handleAdminDeleteHelpArticle(ctx.storage, ctx.actor, id);
          return sendJson(res, result.body, result.status);
        }
        return sendJson(res, { success: false, error: "Method not allowed." }, 405);
      } catch (err) {
        return sendJson(res, { success: false, error: err?.message || "Help article request failed" }, 500);
      }
    }
  };
}
var defaultHandlers = createCmsNodeHandlers();
var handlePublicCmsPagesGetRequest = defaultHandlers.handlePublicCmsPagesGet;
var handlePublicFaqsGetRequest = defaultHandlers.handlePublicFaqsGet;
var handlePublicHelpArticlesGetRequest = defaultHandlers.handlePublicHelpArticlesGet;
var handleAdminCmsPagesGetRequest = defaultHandlers.handleAdminCmsPagesGet;
var handleAdminCmsDraftSaveRequest = defaultHandlers.handleAdminCmsDraftSave;
var handleAdminCmsPublishRequest = defaultHandlers.handleAdminCmsPublish;
var handleAdminCmsUnpublishRequest = defaultHandlers.handleAdminCmsUnpublish;
var handleAdminCmsDeleteRequest = defaultHandlers.handleAdminCmsDelete;
var handleAdminCmsVersionsRequest = defaultHandlers.handleAdminCmsVersions;
var handleAdminCmsRestoreRequest = defaultHandlers.handleAdminCmsRestore;
var handleAdminCmsSeedRequest = defaultHandlers.handleAdminCmsSeed;
var handleAdminCmsRefreshRequest = defaultHandlers.handleAdminCmsRefresh;
var handleAdminFaqsRequest = defaultHandlers.handleAdminFaqs;
var handleAdminHelpArticlesRequest = defaultHandlers.handleAdminHelpArticles;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCmsNodeHandlers,
  createFirebaseAdminCmsAdapter,
  handleAdminCmsDeleteRequest,
  handleAdminCmsDraftSaveRequest,
  handleAdminCmsPagesGetRequest,
  handleAdminCmsPublishRequest,
  handleAdminCmsRefreshRequest,
  handleAdminCmsRestoreRequest,
  handleAdminCmsSeedRequest,
  handleAdminCmsUnpublishRequest,
  handleAdminCmsVersionsRequest,
  handleAdminFaqsRequest,
  handleAdminHelpArticlesRequest,
  handlePublicCmsPagesGetRequest,
  handlePublicFaqsGetRequest,
  handlePublicHelpArticlesGetRequest
});
