import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getSiteSettings } from "./firestore";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import {
  normalizeHttpBaseUrl,
  resolveCanonicalUrl,
  resolveSeoImageUrl,
} from "./settings-validation";
import type { SiteSettings } from "./types";

export interface SEOProps {
  title?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterTitle?: string;
  twitterDescription?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any>;
}

// In-memory cache for site settings to prevent repeated reads
let cachedSiteSettings: SiteSettings | null = null;
let settingsFetchPromise: Promise<SiteSettings | null> | null = null;

export async function fetchSiteSettingsCached(): Promise<SiteSettings | null> {
  if (cachedSiteSettings) return cachedSiteSettings;
  if (!settingsFetchPromise) {
    settingsFetchPromise = getSiteSettings()
      .then((data) => {
        cachedSiteSettings = data;
        return data;
      })
      .catch((err) => {
        console.warn("[SEO] Could not load dynamic site settings:", err);
        return null;
      });
  }
  return settingsFetchPromise;
}

export function clearSiteSettingsCache() {
  cachedSiteSettings = null;
  settingsFetchPromise = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lc-site-settings-updated"));
  }
}

/**
 * List of private or transactional routes that must ALWAYS have noindex, nofollow
 */
const PRIVATE_ROUTE_PREFIXES = [
  "/webmaster",
  "/admin",
  "/dashboard",
  "/submit",
  "/login",
  "/register",
  "/verify-email",
  "/verify-handler",
  "/email-action",
  "/reset-password",
];

export function isPrivateRoute(path: string): boolean {
  const cleanPath = (path || "/").split("?")[0].split("#")[0] || "/";
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)
  );
}

export interface ResolvedDocumentHead {
  pageTitle: string;
  description: string;
  keywords: string;
  robots: "index, follow" | "noindex, nofollow";
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogType: "website" | "article";
  ogSiteName: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  globalJsonLd: Record<string, any>;
  pageJsonLd?: Record<string, any>;
}

/**
 * Pure, deterministic SEO resolution function combining global SiteSettings
 * with active route/page overrides.
 */
export function resolveDocumentHeadMetadata(params: {
  location: string;
  settings?: Partial<SiteSettings> | null;
  page?: SEOProps | null;
  runtimeOrigin?: string;
}): ResolvedDocumentHead {
  const { location, settings, page, runtimeOrigin } = params;
  const cleanPath = (location || "/").split("?")[0].split("#")[0] || "/";
  const isHomeRoute = cleanPath === "/";

  const siteName = settings?.siteName?.trim() || "LinkCloud";
  const defaultDesc =
    settings?.metaDescription?.trim() ||
    settings?.siteDescription?.trim() ||
    "India's Premium WhatsApp & Telegram Community Directory. Discover verified active groups.";
  const defaultKeywords =
    settings?.metaKeywords?.trim() ||
    "WhatsApp groups, Telegram channels, Discord servers, India group links";

  const detectedOrigin =
    runtimeOrigin && !runtimeOrigin.includes("localhost")
      ? runtimeOrigin
      : "https://linkcloud.in";

  // Respect Webmaster's configured canonicalUrl unconditionally when valid (never bypass linkcloud.in)
  const canonicalBase = normalizeHttpBaseUrl(settings?.canonicalUrl, detectedOrigin);

  // 1. Document <title>
  const pageTitleInput = page?.title?.trim();
  const pageSubtitleInput = page?.subtitle?.trim();
  let pageTitle = siteName;
  if (pageTitleInput) {
    if (pageTitleInput.includes(siteName)) {
      pageTitle = pageTitleInput;
    } else if (pageSubtitleInput) {
      pageTitle = `${pageTitleInput} — ${pageSubtitleInput} | ${siteName}`;
    } else {
      pageTitle = `${pageTitleInput} — ${siteName}`;
    }
  } else if (settings?.metaTitle?.trim()) {
    pageTitle = settings.metaTitle.trim();
  } else if (settings?.siteTagline?.trim()) {
    pageTitle = `${siteName} — ${settings.siteTagline.trim()}`;
  }

  // 2. Meta Description & Keywords
  const finalDesc = page?.description?.trim() || defaultDesc;
  const finalKeywords = page?.keywords?.trim() || defaultKeywords;

  // 3. Robots directive (private routes & maintenance mode always force noindex)
  const forceNoIndex =
    isPrivateRoute(cleanPath) ||
    Boolean(settings?.maintenanceMode) ||
    page?.noIndex === true;
  const robots: "index, follow" | "noindex, nofollow" = forceNoIndex
    ? "noindex, nofollow"
    : "index, follow";

  // 4. Canonical URL (supports both full http(s) URLs and relative paths)
  const fullCanonical = resolveCanonicalUrl(
    page?.canonicalUrl || page?.canonicalPath,
    canonicalBase,
    cleanPath
  );

  // 5. Open Graph & Twitter Hierarchy:
  //    Page explicit OG/Twitter -> Page Title/Desc (or Home global OG/Twitter override) -> Global Fallback
  const resolvedOgTitle =
    page?.ogTitle?.trim() ||
    (isHomeRoute && settings?.ogTitle?.trim() ? settings.ogTitle.trim() : "") ||
    (pageTitleInput ? pageTitle : settings?.ogTitle?.trim() || pageTitle);

  const resolvedOgDesc =
    page?.ogDescription?.trim() ||
    (page?.description?.trim() ? page.description.trim() : "") ||
    (settings?.ogDescription?.trim() ? settings.ogDescription.trim() : "") ||
    finalDesc;

  const resolvedTwitterTitle =
    page?.twitterTitle?.trim() ||
    page?.ogTitle?.trim() ||
    (isHomeRoute && settings?.twitterCardTitle?.trim() ? settings.twitterCardTitle.trim() : "") ||
    resolvedOgTitle;

  const resolvedTwitterDesc =
    page?.twitterDescription?.trim() ||
    page?.ogDescription?.trim() ||
    (page?.description?.trim() ? page.description.trim() : "") ||
    (settings?.twitterCardDescription?.trim() ? settings.twitterCardDescription.trim() : "") ||
    resolvedOgDesc;

  const resolvedOgImage = resolveSeoImageUrl(
    page?.ogImage || settings?.ogImage,
    canonicalBase
  );
  const resolvedTwitterImage =
    resolveSeoImageUrl(page?.ogImage || settings?.twitterCardImage || settings?.ogImage, canonicalBase) ||
    resolvedOgImage;

  // 6. Global Schema.org JSON-LD
  let globalJsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: canonicalBase,
    description: defaultDesc,
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonicalBase}/groups?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  if (settings?.structuredDataJson?.trim()) {
    try {
      const parsed = JSON.parse(settings.structuredDataJson);
      if (parsed && typeof parsed === "object") {
        globalJsonLd = parsed;
      }
    } catch {
      // Keep generated valid WebSite schema if stored JSON is malformed
    }
  }

  return {
    pageTitle,
    description: finalDesc,
    keywords: finalKeywords,
    robots,
    canonicalUrl: fullCanonical,
    ogTitle: resolvedOgTitle,
    ogDescription: resolvedOgDesc,
    ogUrl: fullCanonical,
    ogType: page?.ogType || "website",
    ogSiteName: siteName,
    ogImage: resolvedOgImage,
    twitterTitle: resolvedTwitterTitle,
    twitterDescription: resolvedTwitterDesc,
    twitterImage: resolvedTwitterImage,
    globalJsonLd,
    pageJsonLd: page?.jsonLd,
  };
}

// ─── Single Authoritative Head Tag Manager ───────────────────────────────────

interface ActivePageOverride {
  token: symbol;
  path: string;
  props: SEOProps;
}

let activePageOverride: ActivePageOverride | null = null;

function setOrCreateMeta(name: string, content: string, isProperty = false) {
  if (typeof document === "undefined") return;
  const attr = isProperty ? "property" : "name";
  const matches = Array.from(
    document.head.querySelectorAll<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  );
  // Deduplicate if any extra tag ever exists
  for (let i = 1; i < matches.length; i++) {
    matches[i].remove();
  }
  let el = matches[0] || null;
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setOrCreateCanonical(url: string) {
  if (typeof document === "undefined") return;
  const matches = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')
  );
  for (let i = 1; i < matches.length; i++) {
    matches[i].remove();
  }
  let el = matches[0] || null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.href = url;
}

function setOrCreateJsonLd(id: string, data?: Record<string, any>) {
  if (typeof document === "undefined") return;
  // Remove legacy duplicate script ID if present
  if (id === "linkcloud-global-jsonld") {
    const legacy = document.getElementById("lc-webmaster-jsonld");
    if (legacy) legacy.remove();
  }
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  try {
    el.textContent = JSON.stringify(data);
  } catch {
    // ignore serialization edge cases
  }
}

function applyUnifiedHead(location: string, settings?: Partial<SiteSettings> | null) {
  if (typeof document === "undefined") return;
  const cleanPath = (location || "/").split("?")[0].split("#")[0] || "/";
  const activePage =
    activePageOverride && activePageOverride.path === cleanPath
      ? activePageOverride.props
      : null;

  const resolved = resolveDocumentHeadMetadata({
    location: cleanPath,
    settings,
    page: activePage,
    runtimeOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
  });

  document.title = resolved.pageTitle;
  setOrCreateMeta("description", resolved.description);
  setOrCreateMeta("keywords", resolved.keywords);
  setOrCreateMeta("robots", resolved.robots);
  setOrCreateCanonical(resolved.canonicalUrl);

  setOrCreateMeta("og:title", resolved.ogTitle, true);
  setOrCreateMeta("og:description", resolved.ogDescription, true);
  setOrCreateMeta("og:url", resolved.ogUrl, true);
  setOrCreateMeta("og:type", resolved.ogType, true);
  setOrCreateMeta("og:site_name", resolved.ogSiteName, true);
  setOrCreateMeta("og:image", resolved.ogImage, true);

  setOrCreateMeta("twitter:card", "summary_large_image");
  setOrCreateMeta("twitter:title", resolved.twitterTitle);
  setOrCreateMeta("twitter:description", resolved.twitterDescription);
  setOrCreateMeta("twitter:image", resolved.twitterImage);

  setOrCreateJsonLd("linkcloud-global-jsonld", resolved.globalJsonLd);
  setOrCreateJsonLd("page-jsonld", resolved.pageJsonLd);
}

/**
 * Page-level hook for setting explicit SEO metadata reactively through the single unified head writer.
 */
export function usePageSEO({
  title,
  subtitle,
  description,
  keywords,
  canonicalPath,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
  twitterTitle,
  twitterDescription,
  noIndex,
  jsonLd,
}: SEOProps) {
  const [location] = useLocation();
  const { settings } = useSiteSettings();
  const tokenRef = useRef<symbol>(Symbol("page-seo"));

  useEffect(() => {
    const cleanPath = (location || "/").split("?")[0].split("#")[0] || "/";
    const token = tokenRef.current;

    activePageOverride = {
      token,
      path: cleanPath,
      props: {
        title,
        subtitle,
        description,
        keywords,
        canonicalPath,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        ogType,
        twitterTitle,
        twitterDescription,
        noIndex,
        jsonLd,
      },
    };

    applyUnifiedHead(cleanPath, settings);

    return () => {
      if (activePageOverride?.token === token) {
        activePageOverride = null;
      }
    };
  }, [
    title,
    subtitle,
    description,
    keywords,
    canonicalPath,
    canonicalUrl,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    twitterTitle,
    twitterDescription,
    noIndex,
    jsonLd,
    location,
    settings,
  ]);
}

/**
 * Backwards-compatible convenience wrapper for usePageTitle
 */
export function usePageTitle(title?: string, subtitle?: string, description?: string) {
  usePageSEO({ title, subtitle, description });
}

/**
 * Global SEO hook running in App.tsx.
 * Ensures routes without page-level SEO still get global metadata, canonicals,
 * private-route noindex enforcement, and clean removal of stale page-jsonld.
 */
export function useGlobalSEO() {
  const [location] = useLocation();
  const { settings } = useSiteSettings();

  useEffect(() => {
    applyUnifiedHead(location, settings);
  }, [location, settings]);
}
