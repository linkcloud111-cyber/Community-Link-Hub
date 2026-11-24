import type {
  CmsAutoSeedPlanItem,
  CmsAutoSeedResponse,
  CmsPageAdminOverview,
  CmsPageDocument,
  CmsPageHealthStatus,
  CmsPageSlug,
  CmsRefreshResponse,
  CmsVersionRecord,
  FAQItem,
  HelpArticle,
} from "../lib/types";
import {
  buildDefaultCmsSeedTemplate,
  CMS_PAGE_DEFAULT_NAV_VISIBLE,
  CMS_PAGE_DEFAULT_ORDER,
  CMS_PAGE_SLUGS,
  detectUnverifiedClaims,
  getCmsRouteForSlug,
  isIncompleteLegacyText,
  isLegalCmsSlug,
  isProtectedCoreCmsSlug,
  isValidCmsSlug,
  validateAndNormalizeCmsPageInput,
  validateFaqPayload,
  validateHelpArticlePayload,
} from "../lib/cms-schema";

export interface CmsAuthActor {
  uid: string;
  email: string;
}

export interface CmsAuditEntry {
  action: string;
  details: string;
  adminEmail: string;
  adminUid: string;
  actorEmail: string;
  actorUid: string;
  target?: string;
  outcome: "success" | "failure" | "dry_run";
  createdAt: string;
  timestamp: string;
}

export interface CmsStorageAdapter {
  getDoc(path: string): Promise<Record<string, any> | null>;
  setDoc(path: string, data: Record<string, any>, merge?: boolean): Promise<void>;
  deleteDoc(path: string): Promise<void>;
  listCollection(
    collectionPath: string,
    limit?: number
  ): Promise<Array<{ id: string; [key: string]: any }>>;
  addAuditLog(entry: CmsAuditEntry): Promise<void>;
}

export interface CmsHandlerResponse<T = any> {
  status: number;
  body: T;
}

function makeVersionId(version: number, prefix = "v"): string {
  return `${prefix}${version}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getLegacyTextForSlug(
  slug: CmsPageSlug,
  siteSettings: Record<string, any> | null,
  staticPages: Record<string, any> | null
): string | null {
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

function buildLegacyArchiveSnapshot(
  slug: CmsPageSlug,
  legacyText: string,
  nowIso: string
): CmsPageDocument {
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
        text: legacyText.slice(0, 4000),
      },
    ],
    seo: {
      seoTitle: `${slug.toUpperCase()} — LinkCloud`,
      seoDescription: "Preserved legacy static page record.",
      seoKeywords: slug,
      canonicalUrl: getCmsRouteForSlug(slug),
      noIndex: false,
    },
    status: "draft",
    isLegalPage: isLegalCmsSlug(slug),
    enabled: true,
    publicVisible: true,
    footerVisible: true,
    navVisible: CMS_PAGE_DEFAULT_NAV_VISIBLE[slug],
    displayOrder: CMS_PAGE_DEFAULT_ORDER[slug],
    lastUpdated: nowIso,
    version: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastPublishedAt: null,
    lastPublishedByUid: null,
    lastPublishedByEmail: null,
    updatedByUid: "legacy-archive",
    updatedByEmail: "system@localhost.invalid",
  };
}

function blocksToPlainSummary(page: CmsPageDocument): string {
  const parts: string[] = [];
  if (page.description) parts.push(page.description);
  for (const blk of page.blocks || []) {
    if (blk.heading) parts.push(blk.heading);
    if (blk.text) parts.push(blk.text);
    if (blk.items?.length) parts.push(blk.items.join("\n"));
    if (blk.question || blk.answer) parts.push(`${blk.question || ""}\n${blk.answer || ""}`);
    if (blk.steps?.length) {
      parts.push(blk.steps.map((s) => `${s.title}: ${s.description}`).join("\n"));
    }
    if (blk.contactEmail) {
      parts.push(`${blk.contactEmail}${blk.contactNote ? ` — ${blk.contactNote}` : ""}`);
    }
  }
  return parts.join("\n\n").slice(0, 12000);
}

async function archiveLegacyIfNeeded(
  storage: CmsStorageAdapter,
  slug: CmsPageSlug,
  existingVersions: Array<{ id: string; [key: string]: any }>,
  actor: CmsAuthActor,
  nowIso: string
): Promise<{ archived: boolean; nextVersionStart: number }> {
  const maxExisting = existingVersions.reduce((max, v) => {
    const n = typeof v.version === "number" ? v.version : 0;
    return n > max ? n : max;
  }, 0);

  if (existingVersions.length > 0) {
    return { archived: false, nextVersionStart: maxExisting + 1 };
  }

  const [siteSettings, staticPages] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages"),
  ]);
  const legacyText = getLegacyTextForSlug(slug, siteSettings, staticPages);
  if (!legacyText) {
    return { archived: false, nextVersionStart: 1 };
  }

  const versionId = makeVersionId(0, "vlegacy_");
  const legacyDoc = buildLegacyArchiveSnapshot(slug, legacyText, nowIso);
  const versionRecord: CmsVersionRecord = {
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
    createdAt: nowIso,
  };
  await storage.setDoc(`cms_pages/${slug}/versions/${versionId}`, versionRecord, false);
  return { archived: true, nextVersionStart: 1 };
}

async function syncPublishedToLegacySettings(
  storage: CmsStorageAdapter,
  page: CmsPageDocument,
  nowIso: string
): Promise<void> {
  const summary = blocksToPlainSummary(page);

  if (page.slug === "about") {
    await storage.setDoc(
      "settings/site",
      {
        aboutTitle: page.title,
        aboutDescription: page.description,
        aboutUsContent: summary,
        updatedAt: nowIso,
      },
      true
    );
    return;
  }

  const siteFieldMap: Partial<Record<CmsPageSlug, string>> = {
    privacy: "privacyPolicyContent",
    terms: "termsContent",
    dmca: "dmcaContent",
    disclaimer: "disclaimerContent",
  };
  const staticFieldMap: Partial<Record<CmsPageSlug, string>> = {
    privacy: "privacy",
    terms: "terms",
    dmca: "dmca",
    disclaimer: "disclaimer",
  };

  const siteField = siteFieldMap[page.slug];
  const staticField = staticFieldMap[page.slug];
  if (siteField && staticField) {
    await Promise.all([
      storage.setDoc(
        "settings/site",
        {
          [siteField]: summary,
          updatedAt: nowIso,
        },
        true
      ),
      storage.setDoc(
        "settings/staticPages",
        {
          [staticField]: summary,
          updatedAt: nowIso,
        },
        true
      ),
    ]);
  }
}

async function computePageOverview(
  storage: CmsStorageAdapter,
  slug: CmsPageSlug,
  siteSettings: Record<string, any> | null,
  staticPages: Record<string, any> | null
): Promise<CmsPageAdminOverview> {
  const [draftRaw, publishedRaw, versionsRaw] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 100),
  ]);

  const draft =
    draftRaw && draftRaw.slug === slug ? (draftRaw as unknown as CmsPageDocument) : null;
  const published =
    publishedRaw &&
    publishedRaw.slug === slug &&
    publishedRaw.status === "published"
      ? (publishedRaw as unknown as CmsPageDocument)
      : null;

  const legacyText = getLegacyTextForSlug(slug, siteSettings, staticPages);
  const legacyIncomplete = legacyText ? isIncompleteLegacyText(legacyText) : false;

  const activeDoc = published || draft;
  let health: CmsPageHealthStatus = "missing";
  let isIncompletePlaceholder = false;
  const warnings: string[] = [];

  if (published) {
    const check = validateAndNormalizeCmsPageInput(published, {
      requireSubstantiveBlocks: true,
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
      requireSubstantiveBlocks: false,
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
      legacyIncomplete
        ? "Only an incomplete 1-line legacy placeholder exists in settings. Run Auto Seed preview or create a structured CMS draft."
        : "Legacy text exists in settings, but no structured CMS page has been created yet."
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
    versionCount: activeDoc
      ? Math.max(versionsRaw.length, activeDoc.version || 0)
      : versionsRaw.length,
    warnings,
  };
}

// ─── Public Read Handlers (No Drafts / No Versions Exposed) ───────────────────

export async function handlePublicGetCmsPage(
  storage: CmsStorageAdapter,
  slugRaw: unknown,
  options?: { includeDrafts?: unknown; list?: unknown }
): Promise<CmsHandlerResponse> {
  if (options?.includeDrafts === "true" || options?.includeDrafts === true) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Forbidden: Draft content cannot be requested on the public CMS endpoint.",
      },
    };
  }

  const isExploreList =
    options?.list === "explore" ||
    slugRaw === undefined ||
    slugRaw === null ||
    String(slugRaw).trim() === "";

  if (isExploreList) {
    const docs = await Promise.all(
      CMS_PAGE_SLUGS.map((slug) => storage.getDoc(`cms_pages/${slug}`))
    );
    const pages = docs
      .filter(
        (doc): doc is Record<string, any> =>
          Boolean(
            doc &&
              doc.status === "published" &&
              doc.enabled !== false &&
              doc.publicVisible !== false
          )
      )
      .map((doc) => {
        const slug = doc.slug as CmsPageSlug;
        return {
          slug,
          route: doc.route || getCmsRouteForSlug(slug),
          title: doc.title,
          subtitle: doc.subtitle || "",
          description: doc.description || "",
          status: "published" as const,
          isLegalPage: Boolean(doc.isLegalPage),
          enabled: true,
          publicVisible: true,
          footerVisible: doc.footerVisible !== false,
          navVisible:
            doc.navVisible !== undefined
              ? Boolean(doc.navVisible)
              : CMS_PAGE_DEFAULT_NAV_VISIBLE[slug],
          displayOrder: Number.isFinite(Number(doc.displayOrder))
            ? Number(doc.displayOrder)
            : CMS_PAGE_DEFAULT_ORDER[slug],
          lastUpdated: doc.lastUpdated || doc.lastPublishedAt || doc.updatedAt,
          lastPublishedAt: doc.lastPublishedAt || doc.updatedAt,
          seo: doc.seo,
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      status: 200,
      body: {
        success: true,
        pages,
      },
    };
  }

  if (!isValidCmsSlug(slugRaw)) {
    return {
      status: 400,
      body: {
        success: false,
        error: `Invalid CMS page slug '${String(slugRaw || "")}'.`,
      },
    };
  }

  const publishedDoc = await storage.getDoc(`cms_pages/${slugRaw}`);
  if (
    publishedDoc &&
    publishedDoc.status === "published" &&
    (publishedDoc.enabled === false || publishedDoc.publicVisible === false)
  ) {
    return {
      status: 200,
      body: {
        success: true,
        published: false,
        disabled: true,
        page: null,
      },
    };
  }

  if (!publishedDoc || publishedDoc.status !== "published") {
    const draftDoc = await storage.getDoc(`cms_drafts/${slugRaw}`);
    const explicitlyDisabled = Boolean(
      draftDoc && (draftDoc.enabled === false || draftDoc.publicVisible === false)
    );
    return {
      status: 200,
      body: {
        success: true,
        published: false,
        disabled: explicitlyDisabled,
        page: null,
      },
    };
  }

  // Strip any internal-only audit properties just in case, projecting only public display fields
  const page = publishedDoc as unknown as CmsPageDocument;
  return {
    status: 200,
    body: {
      success: true,
      published: true,
      disabled: false,
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
        enabled: page.enabled !== false,
        publicVisible: page.publicVisible !== false,
        footerVisible: page.footerVisible !== false,
        navVisible:
          page.navVisible !== undefined
            ? Boolean(page.navVisible)
            : CMS_PAGE_DEFAULT_NAV_VISIBLE[page.slug],
        displayOrder: Number.isFinite(Number(page.displayOrder))
          ? Number(page.displayOrder)
          : CMS_PAGE_DEFAULT_ORDER[page.slug],
        lastUpdated: page.lastUpdated || page.lastPublishedAt || page.updatedAt,
        version: page.version,
        updatedAt: page.updatedAt,
        lastPublishedAt: page.lastPublishedAt || page.updatedAt,
      },
    },
  };
}

export async function handlePublicGetFaqs(
  storage: CmsStorageAdapter
): Promise<CmsHandlerResponse> {
  const raw = await storage.listCollection("faqs", 500);
  const faqs = raw
    .filter((item) => item.enabled !== false && item.status !== "draft")
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      category: item.category || "General",
      enabled: true,
      sortOrder: Number(item.sortOrder) || 0,
      status: item.status || "published",
    }));

  return {
    status: 200,
    body: {
      success: true,
      faqs,
    },
  };
}

export async function handlePublicGetHelpArticles(
  storage: CmsStorageAdapter
): Promise<CmsHandlerResponse> {
  const raw = await storage.listCollection("help_articles", 500);
  const articles = raw
    .filter((item) => item.enabled !== false && item.status !== "draft")
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((item) => ({
      id: item.id,
      category: item.category || "General",
      title: item.title,
      content: item.content,
      steps: Array.isArray(item.steps) ? item.steps : [],
      enabled: true,
      sortOrder: Number(item.sortOrder) || 0,
      status: item.status || "published",
      views: Number(item.views) || 0,
      icon: item.icon || "",
    }));

  return {
    status: 200,
    body: {
      success: true,
      articles,
    },
  };
}

// ─── Webmaster CMS Endpoints ──────────────────────────────────────────────────

export async function handleAdminGetCmsPages(
  storage: CmsStorageAdapter,
  slugRaw?: unknown
): Promise<CmsHandlerResponse> {
  if (slugRaw !== undefined && slugRaw !== null && slugRaw !== "") {
    if (!isValidCmsSlug(slugRaw)) {
      return {
        status: 400,
        body: { success: false, error: `Invalid CMS slug '${String(slugRaw)}'.` },
      };
    }
    const [siteSettings, staticPages] = await Promise.all([
      storage.getDoc("settings/site"),
      storage.getDoc("settings/staticPages"),
    ]);
    const overview = await computePageOverview(storage, slugRaw, siteSettings, staticPages);
    return {
      status: 200,
      body: {
        success: true,
        page: overview,
        pages: [overview],
      },
    };
  }

  const [siteSettings, staticPages] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages"),
  ]);
  const pages = await Promise.all(
    CMS_PAGE_SLUGS.map((slug) =>
      computePageOverview(storage, slug, siteSettings, staticPages)
    )
  );
  return {
    status: 200,
    body: {
      success: true,
      pages,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleAdminSaveCmsDraft(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  const validation = validateAndNormalizeCmsPageInput(body, {
    requireSubstantiveBlocks: false,
  });
  if (!validation.valid || !validation.normalized) {
    return {
      status: 400,
      body: {
        success: false,
        error: validation.error || "CMS validation failed.",
        fieldErrors: validation.fieldErrors || {},
      },
    };
  }

  const normalized = validation.normalized;
  const nowIso = new Date().toISOString();

  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${normalized.slug}`),
    storage.getDoc(`cms_pages/${normalized.slug}`),
    storage.listCollection(`cms_pages/${normalized.slug}/versions`, 200),
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

  const draftDoc: CmsPageDocument = {
    slug: normalized.slug,
    route: normalized.route,
    title: normalized.title,
    subtitle: normalized.subtitle,
    description: normalized.description,
    blocks: normalized.blocks,
    seo: normalized.seo,
    status: existingPublished?.status === "published" ? "published" : "draft",
    isLegalPage: normalized.isLegalPage,
    enabled: normalized.enabled,
    publicVisible: normalized.publicVisible,
    footerVisible: normalized.footerVisible,
    navVisible: normalized.navVisible,
    displayOrder: normalized.displayOrder,
    lastUpdated: nowIso,
    version: nextVersion,
    createdAt: existingDraft?.createdAt || existingPublished?.createdAt || nowIso,
    updatedAt: nowIso,
    lastPublishedAt: existingPublished?.lastPublishedAt || existingDraft?.lastPublishedAt || null,
    lastPublishedByUid:
      existingPublished?.lastPublishedByUid || existingDraft?.lastPublishedByUid || null,
    lastPublishedByEmail:
      existingPublished?.lastPublishedByEmail || existingDraft?.lastPublishedByEmail || null,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
  };

  const versionId = makeVersionId(nextVersion);
  const versionRecord: CmsVersionRecord = {
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
    createdAt: nowIso,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      message: `Draft saved for ${normalized.route} (v${nextVersion}).`,
      draft: draftDoc,
      versionId,
      warnings: detectUnverifiedClaims(draftDoc),
    },
  };
}

export async function handleAdminPublishCmsPage(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  if (!body || typeof body !== "object" || !isValidCmsSlug(body.slug)) {
    return {
      status: 400,
      body: { success: false, error: "Valid CMS page slug is required to publish." },
    };
  }

  const slug = body.slug as CmsPageSlug;
  const nowIso = new Date().toISOString();
  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200),
  ]);

  const sourcePayload =
    body.title && Array.isArray(body.blocks)
      ? body
      : existingDraft;

  if (!sourcePayload) {
    return {
      status: 404,
      body: {
        success: false,
        error: `No draft content found for '${slug}'. Save a draft before publishing.`,
      },
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
        fieldErrors: validation.fieldErrors || {},
      },
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
  const nextVersion =
    Math.max(
      Number(existingDraft?.version) || 0,
      Number(existingPublished?.version) || 0,
      archiveRes.nextVersionStart - 1
    ) + 1;

  const publishedDoc: CmsPageDocument = {
    slug: normalized.slug,
    route: normalized.route,
    title: normalized.title,
    subtitle: normalized.subtitle,
    description: normalized.description,
    blocks: normalized.blocks,
    seo: normalized.seo,
    status: "published",
    isLegalPage: normalized.isLegalPage,
    enabled: normalized.enabled,
    publicVisible: normalized.publicVisible,
    footerVisible: normalized.footerVisible,
    navVisible: normalized.navVisible,
    displayOrder: normalized.displayOrder,
    lastUpdated: nowIso,
    version: nextVersion,
    createdAt: existingDraft?.createdAt || existingPublished?.createdAt || nowIso,
    updatedAt: nowIso,
    lastPublishedAt: nowIso,
    lastPublishedByUid: actor.uid,
    lastPublishedByEmail: actor.email,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
  };

  const versionId = makeVersionId(nextVersion);
  const versionRecord: CmsVersionRecord = {
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
    createdAt: nowIso,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      message: `Published ${publishedDoc.route} live (v${nextVersion}).`,
      page: publishedDoc,
      versionId,
      warnings: detectUnverifiedClaims(publishedDoc),
    },
  };
}

export async function handleAdminUnpublishCmsPage(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  if (!body || typeof body !== "object" || !isValidCmsSlug(body.slug)) {
    return {
      status: 400,
      body: { success: false, error: "Valid CMS page slug is required to unpublish." },
    };
  }

  const slug = body.slug as CmsPageSlug;
  const nowIso = new Date().toISOString();
  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200),
  ]);

  const baseDoc = (existingDraft || existingPublished) as CmsPageDocument | null;
  if (!baseDoc) {
    return {
      status: 404,
      body: { success: false, error: `CMS page '${slug}' does not exist.` },
    };
  }

  const maxVer = existingVersions.reduce(
    (m, v) => Math.max(m, Number(v.version) || 0),
    Number(baseDoc.version) || 0
  );
  const nextVersion = maxVer + 1;

  const updatedDraft: CmsPageDocument = {
    ...baseDoc,
    slug,
    route: getCmsRouteForSlug(slug),
    status: "draft",
    lastUpdated: nowIso,
    version: nextVersion,
    updatedAt: nowIso,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
  };

  const versionId = makeVersionId(nextVersion);
  const versionRecord: CmsVersionRecord = {
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
    createdAt: nowIso,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      message: `Unpublished ${updatedDraft.route}. Public projection removed; draft & version history preserved.`,
      draft: updatedDraft,
    },
  };
}

export async function handleAdminDeleteCmsPage(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  const slug = body?.slug;
  if (!isValidCmsSlug(slug)) {
    return {
      status: 400,
      body: { success: false, error: "Valid CMS page slug is required to delete." },
    };
  }

  if (isProtectedCoreCmsSlug(slug)) {
    return {
      status: 403,
      body: {
        success: false,
        protected: true,
        error: `Core Explore & Legal page '${getCmsRouteForSlug(slug)}' is protected and cannot be deleted. Use Unpublish or toggle Public/Footer visibility instead.`,
      },
    };
  }

  const [existingDraft, existingPublished, existingVersions] = await Promise.all([
    storage.getDoc(`cms_drafts/${slug}`),
    storage.getDoc(`cms_pages/${slug}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200),
  ]);

  if (!existingDraft && !existingPublished) {
    return {
      status: 404,
      body: { success: false, error: `CMS page '${slug}' has no draft or published record.` },
    };
  }

  const isPublished = existingPublished?.status === "published";
  if (isPublished && body?.confirmDeletePublished !== true) {
    return {
      status: 409,
      body: {
        success: false,
        requiresConfirmation: true,
        error:
          "Cannot delete a currently published CMS page without explicit confirmation (confirmDeletePublished: true). Consider unpublishing first.",
      },
    };
  }

  const nowIso = new Date().toISOString();
  const baseDoc = (existingDraft || existingPublished) as CmsPageDocument;
  const maxVer = existingVersions.reduce(
    (m, v) => Math.max(m, Number(v.version) || 0),
    Number(baseDoc.version) || 0
  );
  const archiveVer = maxVer + 1;
  const versionId = makeVersionId(archiveVer, "vdel_");

  // Preserve recoverable snapshot in revision history even on deletion
  const versionRecord: CmsVersionRecord = {
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
    createdAt: nowIso,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      message: `Deleted CMS page '${slug}'. A recoverable snapshot (v${archiveVer}) remains in version history.`,
      archivedVersionId: versionId,
    },
  };
}

export async function handleAdminGetCmsVersions(
  storage: CmsStorageAdapter,
  slugRaw: unknown
): Promise<CmsHandlerResponse> {
  if (!isValidCmsSlug(slugRaw)) {
    return {
      status: 400,
      body: { success: false, error: `Invalid CMS slug '${String(slugRaw || "")}'.` },
    };
  }

  const rawVersions = await storage.listCollection(`cms_pages/${slugRaw}/versions`, 200);
  const versions = rawVersions
    .map((v) => ({ ...v, versionId: v.versionId || v.id }) as unknown as CmsVersionRecord)
    .sort((a, b) => {
      const vDiff = (Number(b.version) || 0) - (Number(a.version) || 0);
      if (vDiff !== 0) return vDiff;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

  return {
    status: 200,
    body: {
      success: true,
      slug: slugRaw,
      versions,
    },
  };
}

export async function handleAdminRestoreCmsVersion(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
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
        error: "Explicit confirmation (confirmRestore: true) is required to restore a historical version.",
      },
    };
  }

  const [targetVersion, existingVersions, existingPublished] = await Promise.all([
    storage.getDoc(`cms_pages/${slug}/versions/${versionId}`),
    storage.listCollection(`cms_pages/${slug}/versions`, 200),
    storage.getDoc(`cms_pages/${slug}`),
  ]);

  if (!targetVersion || !targetVersion.snapshot) {
    return {
      status: 404,
      body: { success: false, error: `Revision '${versionId}' not found for '${slug}'.` },
    };
  }

  const nowIso = new Date().toISOString();
  const maxVer = existingVersions.reduce(
    (m, v) => Math.max(m, Number(v.version) || 0),
    0
  );
  const nextVersion = maxVer + 1;
  const snap = targetVersion.snapshot as CmsPageDocument;

  // Restore into cms_drafts as draft (never pushes directly over published without review)
  const restoredDraft: CmsPageDocument = {
    ...snap,
    slug,
    route: getCmsRouteForSlug(slug),
    status: existingPublished?.status === "published" ? "published" : "draft",
    enabled: snap.enabled !== false,
    publicVisible: snap.publicVisible !== false,
    footerVisible: snap.footerVisible !== false,
    navVisible:
      snap.navVisible !== undefined
        ? Boolean(snap.navVisible)
        : CMS_PAGE_DEFAULT_NAV_VISIBLE[slug],
    displayOrder: Number.isFinite(Number(snap.displayOrder))
      ? Number(snap.displayOrder)
      : CMS_PAGE_DEFAULT_ORDER[slug],
    lastUpdated: nowIso,
    version: nextVersion,
    updatedAt: nowIso,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
    lastPublishedAt: existingPublished?.lastPublishedAt || null,
    lastPublishedByUid: existingPublished?.lastPublishedByUid || null,
    lastPublishedByEmail: existingPublished?.lastPublishedByEmail || null,
  };

  const newVersionId = makeVersionId(nextVersion);
  const newVersionRecord: CmsVersionRecord = {
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
    createdAt: nowIso,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      message: `Restored v${targetVersion.version} into draft v${nextVersion} for review.`,
      draft: restoredDraft,
      versionId: newVersionId,
    },
  };
}

export async function handleAdminCmsAutoSeed(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse<CmsAutoSeedResponse>> {
  const dryRun = body?.dryRun !== false;
  const nowIso = new Date().toISOString();

  const [siteSettings, staticPages] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages"),
  ]);
  const supportEmail =
    siteSettings?.supportEmail ||
    siteSettings?.officialContactEmail ||
    siteSettings?.contactEmail ||
    "";

  const plan: CmsAutoSeedPlanItem[] = [];
  let createdCount = 0;
  let skippedCount = 0;
  let archivedLegacyCount = 0;

  for (const slug of CMS_PAGE_SLUGS) {
    const [existingDraft, existingPublished, existingVersions] = await Promise.all([
      storage.getDoc(`cms_drafts/${slug}`),
      storage.getDoc(`cms_pages/${slug}`),
      storage.listCollection(`cms_pages/${slug}/versions`, 50),
    ]);

    const legacyText = getLegacyTextForSlug(slug, siteSettings, staticPages);
    const hasExistingCms = Boolean(existingDraft || existingPublished);

    if (hasExistingCms) {
      skippedCount++;
      plan.push({
        slug,
        route: getCmsRouteForSlug(slug),
        action: "skip_existing",
        reason: existingPublished
          ? "Existing published CMS page preserved (never overwritten)."
          : "Existing CMS draft preserved (never overwritten).",
        legacyPlaceholderFound: Boolean(legacyText),
        willAutoPublish: false,
      });
      continue;
    }

    plan.push({
      slug,
      route: getCmsRouteForSlug(slug),
      action: "create_draft",
      reason: isLegalCmsSlug(slug)
        ? "Missing CMS record; will create un-published legal draft (never auto-published)."
        : "Missing CMS record; will create structured draft for Webmaster review.",
      legacyPlaceholderFound: Boolean(legacyText),
      willAutoPublish: false,
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
      // Double check safety invariant: Auto Seed NEVER sets published
      templateDoc.status = "draft";

      const versionId = makeVersionId(templateDoc.version, "vseed_");
      const versionRecord: CmsVersionRecord = {
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
        createdAt: nowIso,
      };

      await Promise.all([
        storage.setDoc(`cms_drafts/${slug}`, templateDoc, false),
        storage.setDoc(`cms_pages/${slug}/versions/${versionId}`, versionRecord, false),
      ]);
      createdCount++;
    }
  }

  await storage.addAuditLog({
    action: dryRun ? "CMS Auto Seed Preview" : "CMS Auto Seed Executed",
    details: dryRun
      ? `Dry-run Auto Seed evaluated 7 CMS pages (${plan.filter((p) => p.action === "create_draft").length} eligible drafts, ${skippedCount} preserved)`
      : `Executed Auto Seed: created ${createdCount} missing drafts, preserved ${skippedCount} existing pages, archived ${archivedLegacyCount} legacy placeholders`,
    adminEmail: actor.email,
    adminUid: actor.uid,
    actorEmail: actor.email,
    actorUid: actor.uid,
    target: "cms_drafts",
    outcome: dryRun ? "dry_run" : "success",
    createdAt: nowIso,
    timestamp: nowIso,
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
      timestamp: nowIso,
    },
  };
}

export async function handleAdminCmsRefresh(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor
): Promise<CmsHandlerResponse<CmsRefreshResponse>> {
  const nowIso = new Date().toISOString();
  const [siteSettings, staticPages, faqs, helpArticles] = await Promise.all([
    storage.getDoc("settings/site"),
    storage.getDoc("settings/staticPages"),
    storage.listCollection("faqs", 500),
    storage.listCollection("help_articles", 500),
  ]);

  const pages = await Promise.all(
    CMS_PAGE_SLUGS.map((slug) =>
      computePageOverview(storage, slug, siteSettings, staticPages)
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
    ).length,
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
    timestamp: nowIso,
  });

  return {
    status: 200,
    body: {
      success: true,
      pages,
      summary,
      timestamp: nowIso,
    },
  };
}

// ─── Webmaster FAQ CRUD Handlers ──────────────────────────────────────────────

export async function handleAdminListFaqs(
  storage: CmsStorageAdapter
): Promise<CmsHandlerResponse> {
  const raw = await storage.listCollection("faqs", 500);
  const faqs = raw
    .map((item) => ({
      ...item,
      id: item.id,
      enabled: item.enabled !== false,
      sortOrder: Number(item.sortOrder) || 0,
      status: item.status || "published",
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { status: 200, body: { success: true, faqs } };
}

export async function handleAdminCreateFaq(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  const existingRaw = await storage.listCollection("faqs", 500);
  const existing = existingRaw.map((d) => d as unknown as FAQItem);

  const check = validateFaqPayload(body, existing);
  if (!check.valid || !check.cleaned) {
    return {
      status: check.isDuplicate ? 409 : 400,
      body: { success: false, error: check.error },
    };
  }

  const nowIso = new Date().toISOString();
  const id = `faq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const faqDoc: FAQItem = {
    id,
    ...check.cleaned,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: actor.uid,
    updatedBy: actor.uid,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 201,
    body: { success: true, id, faq: faqDoc, message: "FAQ created successfully." },
  };
}

export async function handleAdminUpdateFaq(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  const nowIso = new Date().toISOString();

  // Batch reorder support: { reorder: [{ id, sortOrder }] }
  if (Array.isArray(body?.reorder)) {
    const updates = body.reorder.filter(
      (r: any) => typeof r?.id === "string" && Number.isFinite(Number(r?.sortOrder))
    );
    if (updates.length === 0) {
      return { status: 400, body: { success: false, error: "Valid reorder items required." } };
    }
    await Promise.all(
      updates.map((u: any) =>
        storage.setDoc(
          `faqs/${u.id}`,
          {
            sortOrder: Math.max(0, Math.floor(Number(u.sortOrder))),
            updatedAt: nowIso,
            updatedBy: actor.uid,
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
      timestamp: nowIso,
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
    question: body.question !== undefined ? body.question : existing.question,
    answer: body.answer !== undefined ? body.answer : existing.answer,
    category: body.category !== undefined ? body.category : existing.category,
    sortOrder: body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
    enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
    status: body.status !== undefined ? body.status : existing.status,
  };

  const allFaqs = (await storage.listCollection("faqs", 500)) as unknown as FAQItem[];
  const check = validateFaqPayload(mergedInput, allFaqs, id);
  if (!check.valid || !check.cleaned) {
    return {
      status: check.isDuplicate ? 409 : 400,
      body: { success: false, error: check.error },
    };
  }

  const updatedDoc = {
    ...check.cleaned,
    updatedAt: nowIso,
    updatedBy: actor.uid,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      faq: { id, ...updatedDoc },
      message: "FAQ updated successfully.",
    },
  };
}

export async function handleAdminDeleteFaq(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  idRaw: unknown
): Promise<CmsHandlerResponse> {
  const id = typeof idRaw === "string" ? idRaw.trim() : "";
  if (!id) {
    return { status: 400, body: { success: false, error: "FAQ ID is required." } };
  }

  const existing = await storage.getDoc(`faqs/${id}`);
  if (!existing) {
    return { status: 404, body: { success: false, error: "FAQ item not found." } };
  }

  const nowIso = new Date().toISOString();
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
      timestamp: nowIso,
    }),
  ]);

  return { status: 200, body: { success: true, message: "FAQ deleted successfully." } };
}

// ─── Webmaster Help Center CRUD Handlers ──────────────────────────────────────

export async function handleAdminListHelpArticles(
  storage: CmsStorageAdapter
): Promise<CmsHandlerResponse> {
  const raw = await storage.listCollection("help_articles", 500);
  const articles = raw
    .map((item) => ({
      ...item,
      id: item.id,
      steps: Array.isArray(item.steps) ? item.steps : [],
      enabled: item.enabled !== false,
      sortOrder: Number(item.sortOrder) || 0,
      status: item.status || "published",
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { status: 200, body: { success: true, articles } };
}

export async function handleAdminCreateHelpArticle(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  const existing = await storage.listCollection("help_articles", 500);
  const check = validateHelpArticlePayload(body, existing.length);
  if (!check.valid || !check.cleaned) {
    return { status: 400, body: { success: false, error: check.error } };
  }

  const nowIso = new Date().toISOString();
  const id = `help_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const docData: HelpArticle = {
    id,
    ...check.cleaned,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: actor.uid,
    updatedBy: actor.uid,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 201,
    body: {
      success: true,
      id,
      article: docData,
      message: "Help article created successfully.",
    },
  };
}

export async function handleAdminUpdateHelpArticle(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  body: any
): Promise<CmsHandlerResponse> {
  const nowIso = new Date().toISOString();

  if (Array.isArray(body?.reorder)) {
    const updates = body.reorder.filter(
      (r: any) => typeof r?.id === "string" && Number.isFinite(Number(r?.sortOrder))
    );
    if (updates.length === 0) {
      return { status: 400, body: { success: false, error: "Valid reorder items required." } };
    }
    await Promise.all(
      updates.map((u: any) =>
        storage.setDoc(
          `help_articles/${u.id}`,
          {
            sortOrder: Math.max(0, Math.floor(Number(u.sortOrder))),
            updatedAt: nowIso,
            updatedBy: actor.uid,
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
      timestamp: nowIso,
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
    title: body.title !== undefined ? body.title : existing.title,
    category: body.category !== undefined ? body.category : existing.category,
    content: body.content !== undefined ? body.content : existing.content,
    steps: body.steps !== undefined ? body.steps : existing.steps,
    enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
    sortOrder: body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
    status: body.status !== undefined ? body.status : existing.status,
    views: body.views !== undefined ? body.views : existing.views,
    icon: body.icon !== undefined ? body.icon : existing.icon,
  };

  const check = validateHelpArticlePayload(mergedInput);
  if (!check.valid || !check.cleaned) {
    return { status: 400, body: { success: false, error: check.error } };
  }

  const updateDoc = {
    ...check.cleaned,
    updatedAt: nowIso,
    updatedBy: actor.uid,
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      article: { id, ...updateDoc },
      message: "Help article updated successfully.",
    },
  };
}

export async function handleAdminDeleteHelpArticle(
  storage: CmsStorageAdapter,
  actor: CmsAuthActor,
  idRaw: unknown
): Promise<CmsHandlerResponse> {
  const id = typeof idRaw === "string" ? idRaw.trim() : "";
  if (!id) {
    return { status: 400, body: { success: false, error: "Help Article ID is required." } };
  }

  const existing = await storage.getDoc(`help_articles/${id}`);
  if (!existing) {
    return { status: 404, body: { success: false, error: "Help article not found." } };
  }

  const nowIso = new Date().toISOString();
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
      timestamp: nowIso,
    }),
  ]);

  return {
    status: 200,
    body: { success: true, message: "Help article deleted successfully." },
  };
}
