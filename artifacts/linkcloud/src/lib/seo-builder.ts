import { CMS_PAGE_DEFAULT_ORDER } from "./cms-schema";
import {
  OFFICIAL_CANONICAL_ORIGIN,
  resolveActiveCanonicalOrigin,
} from "./settings-validation";

export interface SeoStorageAdapter {
  getDoc: (path: string) => Promise<Record<string, any> | null>;
  listCollection: (
    collectionPath: string,
    limit?: number
  ) => Promise<Array<{ id: string; [key: string]: any }>>;
  queryApprovedGroups?: () => Promise<Array<{ id: string; [key: string]: any }>>;
  queryDisabledLocations?: () => Promise<{
    states: Array<{ id: string; [key: string]: any }>;
    districts: Array<{ id: string; [key: string]: any }>;
    cities: Array<{ id: string; [key: string]: any }>;
  }>;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
}

export interface DynamicSitemapResult {
  xml: string;
  indexingDisabled: boolean;
  origin: string;
  urlCount: number;
  groupQueryFailed?: boolean;
}

export const PRIVATE_DISALLOW_PATHS = [
  "/webmaster",
  "/webmaster/*",
  "/admin",
  "/admin/*",
  "/dashboard",
  "/dashboard/*",
  "/my-groups",
  "/profile",
  "/settings",
  "/submitted-groups",
  "/my-submitted-groups",
  "/my-profile",
  "/profile-settings",
  "/change-password",
  "/account-security",
  "/favorites",
  "/notifications",
  "/verify-email",
  "/verify-handler",
  "/email-action",
  "/reset-password",
];

function slugifyCategory(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function resolveDynamicSeoOrigin(options: {
  canonicalUrl?: string | null;
  envOrigin?: string | null;
  requestUrl?: string | null;
  hostHeader?: string | null;
  forwardedProto?: string | null;
}): string {
  return (
    resolveActiveCanonicalOrigin({
      configuredCanonicalUrl: options.canonicalUrl,
      envOrigin: options.envOrigin,
      requestUrl: options.requestUrl,
      hostHeader: options.hostHeader,
      forwardedProto: options.forwardedProto,
    }) || OFFICIAL_CANONICAL_ORIGIN
  );
}

function toIsoDateOnly(val: any): string {
  try {
    if (!val) return new Date().toISOString().split("T")[0];
    if (typeof val?.toDate === "function") {
      return val.toDate().toISOString().split("T")[0];
    }
    if (typeof val?.seconds === "number") {
      return new Date(val.seconds * 1000).toISOString().split("T")[0];
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {
    // ignore
  }
  return new Date().toISOString().split("T")[0];
}

export async function buildDynamicRobotsTxt(
  storage: SeoStorageAdapter,
  originOptions: Omit<Parameters<typeof resolveDynamicSeoOrigin>[0], "canonicalUrl">
): Promise<string> {
  let settings: Record<string, any> | null = null;
  try {
    settings = await storage.getDoc("settings/site");
  } catch {
    settings = null;
  }

  const origin = resolveDynamicSeoOrigin({
    ...originOptions,
    canonicalUrl: settings?.canonicalUrl,
  });

  if (settings?.allowIndexing === false) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  return [
    "User-agent: *",
    "Allow: /",
    ...PRIVATE_DISALLOW_PATHS.map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

function isApprovedPublicActiveGroup(
  group: Record<string, any>,
  disabledStateSet: Set<string>,
  disabledDistrictSet: Set<string>,
  disabledCitySet: Set<string>
): boolean {
  if (!group || group.status !== "approved" || group.hidden === true) return false;
  if (typeof group.linkStatus === "string" && group.linkStatus.toLowerCase() === "inactive") {
    return false;
  }
  const st = typeof group.state === "string" ? group.state.trim().toLowerCase() : "";
  const dist = typeof group.district === "string" ? group.district.trim().toLowerCase() : "";
  const city = typeof group.city === "string" ? group.city.trim().toLowerCase() : "";
  if (st && disabledStateSet.has(st)) return false;
  if (dist && disabledDistrictSet.has(`${st}:${dist}`)) return false;
  if (city && disabledCitySet.has(`${st}:${city}`)) return false;
  return true;
}

function groupMatchesCategory(group: Record<string, any>, cat: Record<string, any>): boolean {
  const targets = new Set(
    [cat.id, cat.slug, cat.name, slugifyCategory(cat.name || "")]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim().toLowerCase())
  );
  if (targets.size === 0) return false;

  const gCatId = String(group.categoryId || "").trim().toLowerCase();
  const gCatName = String(group.categoryName || "").trim().toLowerCase();
  const gCatSlug = slugifyCategory(gCatName);
  const gCategory = String(group.category || "").trim().toLowerCase();

  return (
    (Boolean(gCatId) && targets.has(gCatId)) ||
    (Boolean(gCatName) && targets.has(gCatName)) ||
    (Boolean(gCatSlug) && targets.has(gCatSlug)) ||
    (Boolean(gCategory) && targets.has(gCategory))
  );
}

export async function buildDynamicSitemapResult(
  storage: SeoStorageAdapter,
  originOptions: Omit<Parameters<typeof resolveDynamicSeoOrigin>[0], "canonicalUrl">
): Promise<DynamicSitemapResult> {
  let settings: Record<string, any> | null = null;
  try {
    settings = await storage.getDoc("settings/site");
  } catch {
    settings = null;
  }

  const origin = resolveDynamicSeoOrigin({
    ...originOptions,
    canonicalUrl: settings?.canonicalUrl,
  });

  if (settings?.allowIndexing === false || settings?.maintenanceMode === true) {
    return {
      xml: "",
      indexingDisabled: true,
      origin,
      urlCount: 0,
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const entries: SitemapEntry[] = [
    { loc: `${origin}/`, lastmod: today, changefreq: "daily", priority: "1.0" },
  ];

  const isDirectoryEnabled =
    settings?.publicDirectoryEnabled !== false && settings?.enableGroupDirectory !== false;
  const isContactEnabled =
    settings?.contactFormEnabled !== false && settings?.enableContactPage !== false;
  const isComplaintEnabled =
    settings?.complaintSystemEnabled !== false && settings?.enableComplaintPage !== false;

  if (isDirectoryEnabled) {
    entries.push({ loc: `${origin}/groups`, lastmod: today, changefreq: "daily", priority: "0.9" });
  }
  if (isContactEnabled) {
    entries.push({ loc: `${origin}/contact`, lastmod: today, changefreq: "monthly", priority: "0.6" });
  }
  if (isComplaintEnabled) {
    entries.push({ loc: `${origin}/complaint`, lastmod: today, changefreq: "monthly", priority: "0.5" });
  }

  const seenLocs = new Set(entries.map((e) => e.loc));

  // Published & indexable CMS pages from Firestore
  try {
    const cmsPages = await storage.listCollection("cms_pages", 60);
    const publishedPages = cmsPages
      .filter((page) => {
        const slug = String(page.slug || page.id || "").trim();
        if (!slug) return false;
        if (page.status !== "published") return false;
        if (page.enabled === false) return false;
        if (page.publicVisible === false) return false;
        if (page.seo?.noIndex === true || page.robotsNoIndex === true) return false;
        return true;
      })
      .sort((a, b) => {
        const oa =
          typeof a.displayOrder === "number"
            ? a.displayOrder
            : CMS_PAGE_DEFAULT_ORDER[a.slug as keyof typeof CMS_PAGE_DEFAULT_ORDER] ?? 99;
        const ob =
          typeof b.displayOrder === "number"
            ? b.displayOrder
            : CMS_PAGE_DEFAULT_ORDER[b.slug as keyof typeof CMS_PAGE_DEFAULT_ORDER] ?? 99;
        return oa - ob;
      });

    for (const page of publishedPages) {
      const slug = String(page.slug || page.id).trim();
      const rawRoute =
        typeof page.route === "string" && page.route.startsWith("/") ? page.route : `/${slug}`;
      const loc = `${origin}${rawRoute}`;
      if (seenLocs.has(loc)) continue;
      seenLocs.add(loc);
      entries.push({
        loc,
        lastmod: toIsoDateOnly(page.lastPublishedAt || page.lastUpdated || page.updatedAt),
        changefreq: page.isLegalPage ? "monthly" : "weekly",
        priority: slug === "about" || slug === "faq" || slug === "help" ? "0.7" : "0.4",
      });
    }
  } catch (err: any) {
    console.warn("[SEO Sitemap] Skipping cms_pages lookup:", err?.message || err);
  }

  let groupQueryFailed = false;

  // Directory: Approved, active, non-hidden groups & non-empty active categories
  if (isDirectoryEnabled) {
    const disabledStateSet = new Set<string>();
    const disabledDistrictSet = new Set<string>();
    const disabledCitySet = new Set<string>();

    let rawGroups: Array<{ id: string; [key: string]: any }> = [];
    try {
      rawGroups = storage.queryApprovedGroups
        ? await storage.queryApprovedGroups()
        : await storage.listCollection("groups", 5000);
    } catch (err: any) {
      groupQueryFailed = true;
      console.warn("[SEO Sitemap] Group query failed:", err?.message || err);
    }

    if (rawGroups.length > 0) {
      try {
        const locData = storage.queryDisabledLocations
          ? await storage.queryDisabledLocations()
          : {
              states: await storage.listCollection("states", 200).catch(() => []),
              districts: await storage.listCollection("districts", 1500).catch(() => []),
              cities: await storage.listCollection("cities", 3000).catch(() => []),
            };
        for (const s of locData.states) {
          if ((s.enabled === false || s.status === "disabled") && s.name) {
            disabledStateSet.add(String(s.name).trim().toLowerCase());
          }
        }
        for (const d of locData.districts) {
          if ((d.enabled === false || d.status === "disabled") && d.name) {
            disabledDistrictSet.add(
              `${String(d.stateName || "").trim()}:${String(d.name).trim()}`.toLowerCase()
            );
          }
        }
        for (const c of locData.cities) {
          if ((c.enabled === false || c.status === "disabled") && c.name) {
            disabledCitySet.add(
              `${String(c.stateName || "").trim()}:${String(c.name).trim()}`.toLowerCase()
            );
          }
        }
      } catch (err: any) {
        console.warn("[SEO Sitemap] Location filter check failed:", err?.message || err);
      }
    }

    const indexableGroups = rawGroups.filter((group) =>
      isApprovedPublicActiveGroup(group, disabledStateSet, disabledDistrictSet, disabledCitySet)
    );

    try {
      const categories = await storage.listCollection("categories", 200);
      for (const cat of categories) {
        if (cat.status === "disabled" || cat.enabled === false) continue;
        const key = String(cat.slug || cat.id || "").trim();
        if (!key) continue;

        // Only include category URLs in sitemap when at least 1 active public group matches
        const hasIndexableGroups = indexableGroups.some((g) => groupMatchesCategory(g, cat));
        if (!hasIndexableGroups) continue;

        const loc = `${origin}/groups?category=${encodeURIComponent(key)}`;
        if (seenLocs.has(loc)) continue;
        seenLocs.add(loc);
        entries.push({
          loc,
          lastmod: toIsoDateOnly(cat.updatedAt),
          changefreq: "weekly",
          priority: "0.8",
        });
      }
    } catch (err: any) {
      console.warn("[SEO Sitemap] Category lookup failed:", err?.message || err);
    }

    for (const group of indexableGroups) {
      const id = String(group.id || "").trim();
      if (!id) continue;
      const loc = `${origin}/groups/${encodeURIComponent(id)}`;
      if (seenLocs.has(loc)) continue;
      seenLocs.add(loc);
      entries.push({
        loc,
        lastmod: toIsoDateOnly(group.updatedAt || group.createdAt),
        changefreq: "weekly",
        priority: group.featured ? "0.8" : "0.7",
      });
    }
  }

  const cappedEntries = entries.slice(0, 50000);
  const urlNodes = cappedEntries
    .map(
      (entry) =>
        `  <url>\n` +
        `    <loc>${escapeXml(entry.loc)}</loc>\n` +
        (entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n` : "") +
        (entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>\n` : "") +
        (entry.priority ? `    <priority>${entry.priority}</priority>\n` : "") +
        `  </url>`
    )
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlNodes}\n` +
    `</urlset>\n`;

  return {
    xml,
    indexingDisabled: false,
    origin,
    urlCount: cappedEntries.length,
    groupQueryFailed,
  };
}

export async function buildDynamicSitemapXml(
  storage: SeoStorageAdapter,
  originOptions: Omit<Parameters<typeof resolveDynamicSeoOrigin>[0], "canonicalUrl">
): Promise<string> {
  const result = await buildDynamicSitemapResult(storage, originOptions);
  return result.xml;
}
