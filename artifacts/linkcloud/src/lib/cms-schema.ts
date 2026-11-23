import type {
  AuthorableCmsBlockType,
  CmsBlockType,
  CmsPageDocument,
  CmsPageSeo,
  CmsPageSlug,
  CmsPageStatus,
  CmsSectionBlock,
  CmsStepItem,
  FAQItem,
  HelpArticle,
} from "./types";

export const CMS_PAGE_SLUGS: readonly CmsPageSlug[] = [
  "about",
  "faq",
  "help",
  "privacy",
  "terms",
  "dmca",
  "disclaimer",
] as const;

export const LEGAL_PAGE_SLUGS: readonly CmsPageSlug[] = [
  "privacy",
  "terms",
  "dmca",
  "disclaimer",
] as const;

export const CMS_PAGE_ROUTES: Record<CmsPageSlug, string> = {
  about: "/about",
  faq: "/faq",
  help: "/help",
  privacy: "/privacy",
  terms: "/terms",
  dmca: "/dmca",
  disclaimer: "/disclaimer",
};

export const CMS_PAGE_LABELS: Record<CmsPageSlug, string> = {
  about: "About Us",
  faq: "FAQ",
  help: "Help Center",
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
  dmca: "DMCA Copyright Policy",
  disclaimer: "Legal Disclaimer",
};

export const ALLOWED_BLOCK_TYPES: readonly AuthorableCmsBlockType[] = [
  "heading",
  "paragraph",
  "bullet_list",
  "numbered_list",
  "link",
  "notice",
  "steps",
  "contact_info",
] as const;

/**
 * Legacy 1-line placeholder strings shipped in earlier builds.
 * Used strictly to detect incomplete legacy pages and preserve them
 * in revision history without ever presenting them as complete production copy.
 */
export const KNOWN_LEGACY_PLACEHOLDERS: string[] = [
  "linkcloud respects user privacy. we do not store or inspect private chat content, messages, or member lists.",
  "by using linkcloud, users agree not to submit illegal, spam, copyrighted, or prohibited group links.",
  "to file a copyright takedown request under dmca, please email support@linkcloud.in with link details.",
  "linkcloud is a public indexing platform and is not affiliated with whatsapp, telegram, discord, meta, or google.",
  "linkcloud is india's leading verified directory for whatsapp, telegram, and discord communities.",
];

export function isValidCmsSlug(slug: unknown): slug is CmsPageSlug {
  return typeof slug === "string" && (CMS_PAGE_SLUGS as readonly string[]).includes(slug);
}

export function isLegalCmsSlug(slug: unknown): slug is CmsPageSlug {
  return typeof slug === "string" && (LEGAL_PAGE_SLUGS as readonly string[]).includes(slug);
}

export function getCmsRouteForSlug(slug: CmsPageSlug): string {
  return CMS_PAGE_ROUTES[slug];
}

/**
 * Validates URLs strictly to allow safe relative paths, http(s), and mailto.
 * Explicitly blocks javascript:, data:, vbscript:, file:, and protocol-relative //.
 */
export function isSafeCmsUrl(rawUrl: unknown, allowMailto = false): boolean {
  if (typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) return false;
  // Reject ASCII control chars or whitespace tricks inside scheme
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:") ||
    lower.startsWith("//")
  ) {
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

/**
 * Strips control characters and dangerous HTML/script payloads from plain text input.
 * LinkCloud CMS stores structured plain text blocks (no raw HTML execution).
 */
export function sanitizeCmsText(raw: unknown, maxLen = 4000): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(script|style|iframe|object|embed|svg|img|link|meta|form)[^>]*>/gi, "")
    .replace(/\bon\w+\s*=/gi, "")
    .trim()
    .slice(0, maxLen);
}

export function isIncompleteLegacyText(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return true;
  if (KNOWN_LEGACY_PLACEHOLDERS.includes(normalized)) return true;
  return normalized.length < 160 && !normalized.includes("\n");
}

export function generateBlockId(): string {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface CmsValidationResult {
  valid: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  normalized?: {
    slug: CmsPageSlug;
    route: string;
    title: string;
    subtitle: string;
    description: string;
    blocks: CmsSectionBlock[];
    seo: CmsPageSeo;
    isLegalPage: boolean;
  };
}

export function validateAndNormalizeCmsPageInput(
  raw: any,
  opts?: { requireSubstantiveBlocks?: boolean }
): CmsValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Malformed CMS payload: Expected JSON object." };
  }

  const slug = raw.slug;
  if (!isValidCmsSlug(slug)) {
    return {
      valid: false,
      error: `Invalid CMS page slug '${String(slug || "")}'. Must be one of: ${CMS_PAGE_SLUGS.join(", ")}.`,
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

  const normalizedBlocks: CmsSectionBlock[] = [];
  if (Array.isArray(raw.blocks)) {
    for (let i = 0; i < Math.min(raw.blocks.length, 60); i++) {
      const b = raw.blocks[i];
      if (!b || typeof b !== "object") {
        fieldErrors[`blocks.${i}`] = `Block #${i + 1} is malformed.`;
        continue;
      }
      if (b.type === "faq_item") {
        fieldErrors[`blocks.${i}`] =
          `Block #${i + 1} uses retired type 'faq_item'. Actual FAQ questions and answers must be managed exclusively in Webmaster → FAQ Management.`;
        continue;
      }
      if (!ALLOWED_BLOCK_TYPES.includes(b.type)) {
        fieldErrors[`blocks.${i}`] = `Block #${i + 1} has unsupported type '${String(b.type)}'.`;
        continue;
      }

      const id = sanitizeCmsText(b.id || generateBlockId(), 60) || generateBlockId();
      const type = b.type as AuthorableCmsBlockType;
      const heading = sanitizeCmsText(b.heading || "", 180);
      const text = sanitizeCmsText(b.text || "", 4000);

      if (type === "heading") {
        const headingText = text || heading;
        if (headingText.length < 2) {
          fieldErrors[`blocks.${i}`] = `Heading block #${i + 1} requires heading text.`;
        }
        normalizedBlocks.push({
          id,
          type,
          level: b.level === 3 ? 3 : 2,
          text: headingText,
        });
      } else if (type === "paragraph") {
        if (text.length < 5) {
          fieldErrors[`blocks.${i}`] = `Paragraph block #${i + 1} requires at least 5 characters.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...(heading ? { heading } : {}),
          text,
        });
      } else if (type === "bullet_list" || type === "numbered_list") {
        const items = Array.isArray(b.items)
          ? b.items
              .map((it: any) => sanitizeCmsText(String(it || ""), 500))
              .filter((it: string) => it.length > 0)
              .slice(0, 40)
          : [];
        if (items.length === 0) {
          fieldErrors[`blocks.${i}`] = `List block #${i + 1} requires at least one non-empty item.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...(heading ? { heading } : {}),
          items,
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
          ...(heading ? { heading } : {}),
          ...(text ? { text } : {}),
          label,
          url,
        });
      } else if (type === "notice") {
        if (text.length < 5) {
          fieldErrors[`blocks.${i}`] = `Notice block #${i + 1} requires notice text.`;
        }
        const tone = ["info", "warning", "important", "legal"].includes(b.tone)
          ? b.tone
          : "info";
        normalizedBlocks.push({
          id,
          type,
          ...(heading ? { heading } : {}),
          tone,
          text,
        });
      } else if (type === "steps") {
        const steps: CmsStepItem[] = Array.isArray(b.steps)
          ? b.steps
              .map((st: any) => ({
                title: sanitizeCmsText(st?.title || "", 160),
                description: sanitizeCmsText(st?.description || "", 1000),
              }))
              .filter((st: CmsStepItem) => st.title.length > 0 && st.description.length > 0)
              .slice(0, 25)
          : [];
        if (steps.length === 0) {
          fieldErrors[`blocks.${i}`] = `Steps block #${i + 1} requires at least one step with title & description.`;
        }
        normalizedBlocks.push({
          id,
          type,
          ...(heading ? { heading } : {}),
          steps,
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
          ...(heading ? { heading } : {}),
          contactEmail,
          ...(contactNote ? { contactNote } : {}),
        });
      }
    }
  }

  // Publish completeness check
  if (opts?.requireSubstantiveBlocks) {
    const totalChars = normalizedBlocks.reduce((acc, blk) => {
      return (
        acc +
        (blk.text?.length || 0) +
        (blk.answer?.length || 0) +
        (blk.items?.join(" ").length || 0) +
        (blk.steps?.map((s) => `${s.title} ${s.description}`).join(" ").length || 0)
      );
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
      fieldErrors,
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
        ...(canonicalUrl ? { canonicalUrl } : {}),
        ...(ogTitle ? { ogTitle } : {}),
        ...(ogDescription ? { ogDescription } : {}),
        ...(ogImage ? { ogImage } : {}),
        noIndex: Boolean(rawSeo.noIndex),
      },
      isLegalPage: isLegalCmsSlug(slug),
    },
  };
}

/**
 * Checks structured blocks for potentially unverified claims (fake office street
 * addresses, unverified telephone numbers, absolute security guarantees, etc.)
 * so Webmasters get an explicit review prompt before publishing.
 */
export function detectUnverifiedClaims(page: Pick<CmsPageDocument, "blocks" | "description">): string[] {
  const warnings: string[] = [];
  const combinedText = [
    page.description || "",
    ...page.blocks.map((b) =>
      [
        b.heading,
        b.text,
        b.question,
        b.answer,
        b.contactNote,
        ...(b.items || []),
        ...(b.steps?.map((s) => `${s.title} ${s.description}`) || []),
      ]
        .filter(Boolean)
        .join(" ")
    ),
  ]
    .join(" ")
    .toLowerCase();

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

/**
 * Detects whether a legal CMS document still contains unreviewed starter
 * draft notice boilerplate so the Webmaster UI flags it honestly.
 */
export function hasUnreviewedLegalDraftCopy(
  page: Pick<CmsPageDocument, "subtitle" | "description" | "blocks"> | null | undefined
): boolean {
  if (!page) return false;
  const combined = [
    page.subtitle || "",
    page.description || "",
    ...(Array.isArray(page.blocks)
      ? page.blocks.map((b) => `${b.heading || ""} ${b.text || ""}`)
      : []),
  ]
    .join(" ")
    .toLowerCase();

  return (
    combined.includes("draft legal") ||
    combined.includes("requires owner review before publishing") ||
    combined.includes("owner review required") ||
    combined.startsWith("draft ")
  );
}

/**
 * Generates clean, honest, non-fabricated starter draft templates for Auto Seed.
 * Legal pages ALWAYS initialize as 'draft' so they require explicit review & approval.
 */
export function buildDefaultCmsSeedTemplate(
  slug: CmsPageSlug,
  supportEmail = "support@linkcloud.in",
  nowIso = new Date().toISOString(),
  actor = { uid: "system-seed", email: "webmaster@linkcloud.in" }
): CmsPageDocument {
  const safeSupportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.trim())
    ? supportEmail.trim()
    : "support@linkcloud.in";

  const baseMeta = {
    slug,
    route: getCmsRouteForSlug(slug),
    isLegalPage: isLegalCmsSlug(slug),
    // Never auto-publish legal pages or unreviewed seeded templates
    status: "draft" as CmsPageStatus,
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastPublishedAt: null,
    lastPublishedByUid: null,
    lastPublishedByEmail: null,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
  };

  switch (slug) {
    case "about":
      return {
        ...baseMeta,
        title: "About LinkCloud",
        subtitle: "Public Community Discovery Directory",
        description:
          "Learn how LinkCloud helps visitors discover curated public community invite links across messaging platforms while giving community owners moderation and reporting tools.",
        seo: {
          seoTitle: "About Us — LinkCloud Community Directory",
          seoDescription:
            "Learn about LinkCloud, how community listings are submitted and reviewed, and how visitors can safely discover or report public community links.",
          seoKeywords: "about linkcloud, public community directory, group link guidelines",
          canonicalUrl: "/about",
          noIndex: false,
        },
        blocks: [
          {
            id: "about_intro",
            type: "paragraph",
            heading: "What LinkCloud Is",
            text: "LinkCloud is a curated directory designed to help people discover public community links across platforms such as WhatsApp, Telegram, Discord, and other social channels organized by topic, language, and location.",
          },
          {
            id: "about_scope",
            type: "bullet_list",
            heading: "How the Directory Operates",
            items: [
              "Public browsing of approved community listings without requiring account registration.",
              "Authenticated user submissions reviewed by the Webmaster before appearing publicly.",
              "Community reporting and formal complaint workflows for broken, misleading, or policy-violating links.",
            ],
          },
          {
            id: "about_independence",
            type: "notice",
            heading: "Platform Independence",
            tone: "info",
            text: "LinkCloud does not host third-party chat rooms or inspect private conversations occurring inside external messaging platforms.",
          },
          {
            id: "about_contact",
            type: "contact_info",
            heading: "Directory Support",
            contactEmail: safeSupportEmail,
            contactNote: "For general questions or listing assistance, use the Contact page or email our support desk.",
          },
        ],
      };

    case "faq":
      return {
        ...baseMeta,
        title: "Frequently Asked Questions",
        subtitle: "Directory & Listing Help",
        description:
          "Common questions and answers about browsing LinkCloud, submitting community links, moderation reviews, and reporting broken or unsafe listings.",
        seo: {
          seoTitle: "Frequently Asked Questions — LinkCloud",
          seoDescription:
            "Answers to common questions about browsing public groups, submitting community listings, moderation checks, and safety reporting on LinkCloud.",
          seoKeywords: "linkcloud faq, submit group help, report broken group link",
          canonicalUrl: "/faq",
          noIndex: false,
        },
        blocks: [
          {
            id: "faq_intro",
            type: "paragraph",
            heading: "Using This FAQ",
            text: "Published answers below explain how LinkCloud directory discovery, community submissions, and abuse reporting operate. Individual Q&A entries can be edited, reordered, or toggled in FAQ Management.",
          },
          {
            id: "faq_contact_link",
            type: "link",
            heading: "Need Additional Help?",
            text: "If your question is not covered in the FAQ list below, submit a message through our Contact page.",
            label: "Contact Support Desk",
            url: "/contact",
          },
        ],
      };

    case "help":
      return {
        ...baseMeta,
        title: "Help Center",
        subtitle: "Guides & Support Documentation",
        description:
          "Step-by-step guides for discovering communities, submitting and managing your listings, updating account settings, and reporting policy violations.",
        seo: {
          seoTitle: "Help Center — LinkCloud Guides & Support",
          seoDescription:
            "Read LinkCloud Help Center articles covering community discovery, submitting links, account management, and safety reporting.",
          seoKeywords: "linkcloud help center, submit group guide, report complaint help",
          canonicalUrl: "/help",
          noIndex: false,
        },
        blocks: [
          {
            id: "help_intro",
            type: "paragraph",
            heading: "Help Center Overview",
            text: "Browse published Help Center guides managed by the Webmaster for step-by-step instructions on using LinkCloud.",
          },
          {
            id: "help_steps",
            type: "steps",
            heading: "Getting Support Quickly",
            steps: [
              {
                title: "Search Published Guides",
                description: "Review the Help Center articles below or search the FAQ page for answers to common directory questions.",
              },
              {
                title: "Report a Specific Listing",
                description: "Open the community detail page and use the Report Group option if an invite link is invalid or violates policy.",
              },
              {
                title: "Submit a Formal Grievance or Contact Request",
                description: "Use the Complaint page for urgent takedowns or the Contact page for general account inquiries.",
              },
            ],
          },
          {
            id: "help_complaint_link",
            type: "link",
            heading: "Escalation & Grievance Desk",
            text: "Need to report copyright issues, abuse, or listing removal requests?",
            label: "Open Complaint Portal",
            url: "/complaint",
          },
        ],
      };

    case "privacy":
      return {
        ...baseMeta,
        title: "Privacy Policy",
        subtitle: "Draft Legal Notice — Requires Owner Review Before Publishing",
        description:
          "Draft Privacy Policy describing account data, community listing metadata, authentication infrastructure, and user deletion requests on LinkCloud.",
        seo: {
          seoTitle: "Privacy Policy — LinkCloud",
          seoDescription:
            "Review how LinkCloud handles registration details, community submissions, and account deletion requests.",
          seoKeywords: "linkcloud privacy policy, account data, community submissions",
          canonicalUrl: "/privacy",
          noIndex: false,
        },
        blocks: [
          {
            id: "privacy_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "This legal draft must be reviewed and verified by the Website Owner against actual data-handling and jurisdictional obligations before publishing.",
          },
          {
            id: "privacy_info",
            type: "paragraph",
            heading: "1. Information Collected",
            text: "LinkCloud collects account profile information provided during registration (such as display name, email address, and optional profile details) along with community link metadata submitted for directory review and messages sent via Contact or Complaint forms.",
          },
          {
            id: "privacy_thirdparty_chats",
            type: "paragraph",
            heading: "2. External Messaging Platforms",
            text: "LinkCloud indexes public community invite links only. LinkCloud does not store, read, or monitor private chat messages or member lists inside external messaging platforms.",
          },
          {
            id: "privacy_rights",
            type: "bullet_list",
            heading: "3. Account Controls & Deletion Requests",
            items: [
              "Signed-in users may review or update supported profile fields from their dashboard.",
              "Users can submit an account deletion request through dashboard settings.",
              "Questions or requests regarding account records may be sent via the Contact page or support email.",
            ],
          },
          {
            id: "privacy_contact",
            type: "contact_info",
            heading: "4. Privacy Contact",
            contactEmail: safeSupportEmail,
            contactNote: "Confirm designated privacy/grievance contact details before publishing.",
          },
        ],
      };

    case "terms":
      return {
        ...baseMeta,
        title: "Terms & Conditions",
        subtitle: "Draft Legal Agreement — Requires Owner Review Before Publishing",
        description:
          "Draft Terms and Conditions outlining permitted directory use, submission standards, moderation authority, and external link responsibilities.",
        seo: {
          seoTitle: "Terms & Conditions — LinkCloud",
          seoDescription:
            "Read the draft Terms and Conditions governing directory browsing, user accounts, and community link submissions on LinkCloud.",
          seoKeywords: "linkcloud terms of service, terms and conditions, submission rules",
          canonicalUrl: "/terms",
          noIndex: false,
        },
        blocks: [
          {
            id: "terms_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "This Terms & Conditions draft requires explicit Website Owner review (including governing law and age/eligibility terms) before publishing.",
          },
          {
            id: "terms_conduct",
            type: "bullet_list",
            heading: "1. Prohibited Submissions & Conduct",
            items: [
              "Do not submit unlawful, fraudulent, misleading, spam, or unauthorized copyrighted community links.",
              "Do not attempt unauthorized scraping, automated abuse, or bypassing directory moderation controls.",
              "Ensure submitted community titles, descriptions, and invite links accurately reflect the linked group.",
            ],
          },
          {
            id: "terms_moderation",
            type: "paragraph",
            heading: "2. Directory Moderation",
            text: "LinkCloud Webmaster moderators may approve, reject, hide, or remove any community listing or suspend accounts that violate directory guidelines.",
          },
          {
            id: "terms_external",
            type: "paragraph",
            heading: "3. Third-Party Groups",
            text: "External invite links lead to communities hosted on third-party platforms outside LinkCloud's control. Visitors join third-party communities at their own discretion.",
          },
        ],
      };

    case "dmca":
      return {
        ...baseMeta,
        title: "DMCA & Copyright Takedown Policy",
        subtitle: "Draft Legal Notice — Requires Owner Review Before Publishing",
        description:
          "Draft copyright infringement reporting procedure and required notice elements for requesting removal of directory listings on LinkCloud.",
        seo: {
          seoTitle: "DMCA & Copyright Policy — LinkCloud",
          seoDescription:
            "Procedure for submitting a copyright infringement or listing takedown notice to LinkCloud.",
          seoKeywords: "linkcloud dmca, copyright takedown policy, report infringement",
          canonicalUrl: "/dmca",
          noIndex: false,
        },
        blocks: [
          {
            id: "dmca_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "Verify designated copyright contact/agent information and applicable statutory wording before publishing.",
          },
          {
            id: "dmca_elements",
            type: "numbered_list",
            heading: "Information to Include in a Takedown Notice",
            items: [
              "Identification of the copyrighted work or trademark claimed to be infringed.",
              "Exact LinkCloud listing URL or ID where the material appears.",
              "Your name and valid contact email address for follow-up.",
              "A statement explaining why the listing is unauthorized.",
            ],
          },
          {
            id: "dmca_portal",
            type: "link",
            heading: "Submit Online Notice",
            text: "Copyright notices can be submitted through the Complaint portal.",
            label: "Go to Complaint Portal",
            url: "/complaint",
          },
          {
            id: "dmca_contact",
            type: "contact_info",
            heading: "Copyright Desk Email",
            contactEmail: safeSupportEmail,
          },
        ],
      };

    case "disclaimer":
      return {
        ...baseMeta,
        title: "Legal Disclaimer",
        subtitle: "Draft Legal Notice — Requires Owner Review Before Publishing",
        description:
          "Draft disclaimer clarifying LinkCloud's role as an independent directory index and non-affiliation with third-party messaging platforms.",
        seo: {
          seoTitle: "Legal Disclaimer — LinkCloud",
          seoDescription:
            "Official notice clarifying LinkCloud directory scope, third-party platform non-affiliation, and external community responsibility.",
          seoKeywords: "linkcloud disclaimer, third party non affiliation notice",
          canonicalUrl: "/disclaimer",
          noIndex: false,
        },
        blocks: [
          {
            id: "disc_notice",
            type: "notice",
            heading: "Owner Review Required",
            tone: "legal",
            text: "Verify disclaimer scope and liability language with the Website Owner prior to publishing.",
          },
          {
            id: "disc_nature",
            type: "paragraph",
            heading: "1. Directory Index Scope",
            text: "LinkCloud operates as an informational directory index of user-submitted community invite links and does not operate or host external chat rooms.",
          },
          {
            id: "disc_trademarks",
            type: "paragraph",
            heading: "2. No Third-Party Endorsement",
            text: "LinkCloud is an independent directory and is not affiliated with, endorsed by, or sponsored by WhatsApp, Meta, Telegram, Discord, Google, or any other third-party platform named in directory listings.",
          },
        ],
      };
  }
}

export function normalizeQuestionKey(question: string): string {
  return sanitizeCmsText(question, 300).toLowerCase().replace(/\s+/g, " ");
}

export function validateFaqPayload(
  raw: any,
  existingFaqs: FAQItem[],
  editingId?: string
): {
  valid: boolean;
  error?: string;
  isDuplicate?: boolean;
  cleaned?: {
    question: string;
    answer: string;
    category: string;
    sortOrder: number;
    enabled: boolean;
    status: "draft" | "published";
  };
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Malformed FAQ payload." };
  }

  const question = sanitizeCmsText(raw.question, 300);
  const answer = sanitizeCmsText(raw.answer, 4000);
  const category = sanitizeCmsText(raw.category || "General", 80) || "General";
  const sortOrderRaw = Number(raw.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw)
    ? Math.max(0, Math.min(9999, Math.floor(sortOrderRaw)))
    : existingFaqs.length + 1;
  const enabled = raw.enabled !== false;
  const status: "draft" | "published" = raw.status === "draft" ? "draft" : "published";

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
      error: `Duplicate FAQ question already exists (ID: ${duplicate.id}).`,
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
      status,
    },
  };
}

export function validateHelpArticlePayload(
  raw: any,
  existingCount = 0
): {
  valid: boolean;
  error?: string;
  cleaned?: Omit<HelpArticle, "id">;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Malformed Help Article payload." };
  }

  const title = sanitizeCmsText(raw.title, 180);
  const category = sanitizeCmsText(raw.category || "General", 80) || "General";
  const content = sanitizeCmsText(raw.content, 8000);
  const icon = sanitizeCmsText(raw.icon || "", 60);
  const enabled = raw.enabled !== false;
  const status: "draft" | "published" = raw.status === "draft" ? "draft" : "published";
  const sortOrderRaw = Number(raw.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw)
    ? Math.max(0, Math.min(9999, Math.floor(sortOrderRaw)))
    : existingCount + 1;
  const viewsRaw = Number(raw.views);
  const views = Number.isFinite(viewsRaw) && viewsRaw >= 0 ? Math.floor(viewsRaw) : 0;

  if (title.length < 3) {
    return { valid: false, error: "Help article title must be at least 3 characters." };
  }
  if (content.length < 10) {
    return { valid: false, error: "Help article content must be at least 10 characters." };
  }

  let steps: string[] = [];
  if (Array.isArray(raw.steps)) {
    steps = raw.steps
      .map((s: any) => sanitizeCmsText(String(s || ""), 500))
      .filter((s: string) => s.length > 0)
      .slice(0, 30);
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
      ...(icon ? { icon } : {}),
    },
  };
}
