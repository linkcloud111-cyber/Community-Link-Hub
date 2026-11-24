import type { IncomingMessage, ServerResponse } from "http";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./admin-api";
import { CMS_PAGE_DEFAULT_ORDER } from "../lib/cms-schema";

export interface SeoStorageAdapter {
  getDoc: (path: string) => Promise<Record<string, any> | null>;
  listCollection: (collectionPath: string, limit?: number) => Promise<Array<{ id: string; [key: string]: any }>>;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
}

const PRIVATE_DISALLOW_PATHS = [
  "/webmaster",
  "/webmaster/*",
  "/admin",
  "/admin/*",
  "/dashboard",
  "/dashboard/*",
  "/submit",
  "/verify-email",
  "/verify-handler",
  "/email-action",
  "/login",
  "/register",
  "/reset-password",
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeHttpOrigin(candidate?: string | null): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function resolveDynamicSeoOrigin(options: {
  canonicalUrl?: string | null;
  envOrigin?: string | null;
  requestUrl?: string | null;
  hostHeader?: string | null;
  forwardedProto?: string | null;
}): string {
  const fromSettings = normalizeHttpOrigin(options.canonicalUrl);
  if (fromSettings) return fromSettings;

  const fromEnv = normalizeHttpOrigin(options.envOrigin);
  if (fromEnv) return fromEnv;

  const fromRequestUrl = normalizeHttpOrigin(options.requestUrl);
  if (fromRequestUrl) return fromRequestUrl;

  const host = (options.hostHeader || "").trim();
  if (host) {
    const proto =
      options.forwardedProto?.split(",")[0]?.trim() ||
      (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    const built = normalizeHttpOrigin(`${proto}://${host}`);
    if (built) return built;
  }

  return "http://localhost:3000";
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
    return [
      "User-agent: *",
      "Disallow: /",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n");
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

export async function buildDynamicSitemapXml(
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
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
  }

  const today = new Date().toISOString().split("T")[0];
  const entries: SitemapEntry[] = [
    { loc: `${origin}/`, lastmod: today, changefreq: "daily", priority: "1.0" },
  ];

  if (settings?.enableGroupDirectory !== false) {
    entries.push({ loc: `${origin}/groups`, lastmod: today, changefreq: "daily", priority: "0.9" });
  }
  if (settings?.enableContactPage !== false) {
    entries.push({ loc: `${origin}/contact`, lastmod: today, changefreq: "monthly", priority: "0.6" });
  }
  if (settings?.enableComplaintPage !== false) {
    entries.push({ loc: `${origin}/complaint`, lastmod: today, changefreq: "monthly", priority: "0.5" });
  }

  const seenLocs = new Set(entries.map((e) => e.loc));

  // Published CMS pages
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
        const oa = typeof a.displayOrder === "number" ? a.displayOrder : CMS_PAGE_DEFAULT_ORDER[a.slug as keyof typeof CMS_PAGE_DEFAULT_ORDER] ?? 99;
        const ob = typeof b.displayOrder === "number" ? b.displayOrder : CMS_PAGE_DEFAULT_ORDER[b.slug as keyof typeof CMS_PAGE_DEFAULT_ORDER] ?? 99;
        return oa - ob;
      });

    for (const page of publishedPages) {
      const slug = String(page.slug || page.id).trim();
      const rawRoute = typeof page.route === "string" && page.route.startsWith("/") ? page.route : `/${slug}`;
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
  } catch {
    // Fallback cleanly if Firestore is temporarily unreachable / quota-limited
  }

  // Active Categories & Approved Public Groups
  if (settings?.enableGroupDirectory !== false) {
    try {
      const categories = await storage.listCollection("categories", 100);
      for (const cat of categories) {
        if (cat.status === "disabled" || cat.enabled === false) continue;
        const key = String(cat.slug || cat.id || "").trim();
        if (!key) continue;
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
    } catch {
      // ignore
    }

    try {
      const groups = await storage.listCollection("groups", 400);
      for (const group of groups) {
        if (group.status !== "approved" || group.hidden === true) continue;
        const id = String(group.id || "").trim();
        if (!id) continue;
        const loc = `${origin}/groups/${encodeURIComponent(id)}`;
        if (seenLocs.has(loc)) continue;
        seenLocs.add(loc);
        entries.push({
          loc,
          lastmod: toIsoDateOnly(group.updatedAt || group.createdAt),
          changefreq: "weekly",
          priority: group.featured ? "0.8" : "0.6",
        });
      }
    } catch {
      // ignore
    }
  }

  const urlNodes = entries
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

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlNodes}\n` +
    `</urlset>\n`
  );
}

function createNodeSeoStorage(): SeoStorageAdapter {
  const app = getFirebaseAdminApp();
  const firestore = app ? getFirestore(app) : null;
  return {
    async getDoc(path: string) {
      if (!firestore) return null;
      const snap = await firestore.doc(path).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },
    async listCollection(collectionPath: string, limit = 200) {
      if (!firestore) return [];
      const snap = await firestore.collection(collectionPath).limit(limit).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  };
}

function readHeader(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0] || null;
  return raw || null;
}

export async function handleDynamicRobotsRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  const txt = await buildDynamicRobotsTxt(createNodeSeoStorage(), {
    envOrigin: process.env.APP_URL || process.env.VITE_APP_URL || null,
    hostHeader: readHeader(req, "host"),
    forwardedProto: readHeader(req, "x-forwarded-proto"),
  });
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(req.method === "HEAD" ? "" : txt);
}

export async function handleDynamicSitemapRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  const xml = await buildDynamicSitemapXml(createNodeSeoStorage(), {
    envOrigin: process.env.APP_URL || process.env.VITE_APP_URL || null,
    hostHeader: readHeader(req, "host"),
    forwardedProto: readHeader(req, "x-forwarded-proto"),
  });
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(req.method === "HEAD" ? "" : xml);
}

