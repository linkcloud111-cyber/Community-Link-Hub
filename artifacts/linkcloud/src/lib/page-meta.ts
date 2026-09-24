import { useEffect } from "react";
import { useLocation } from "wouter";
import { getSiteSettings } from "./firestore";
import type { SiteSettings } from "./types";

export interface SEOProps {
  title?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: "website" | "article";
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
}

/**
 * List of private or transactional routes that must ALWAYS have noindex, nofollow
 */
const PRIVATE_ROUTE_PREFIXES = [
  "/webmaster",
  "/dashboard",
  "/submit",
  "/login",
  "/register",
  "/verify-email",
  "/verify-handler",
  "/email-action",
  "/reset-password",
];

function isPrivateRoute(path: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function setOrCreateMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setOrCreateCanonical(url: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.href = url;
}

function setOrCreateJsonLd(id: string, data: Record<string, any>) {
  let el = document.querySelector<HTMLScriptElement>(`script#${id}`);
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  try {
    el.textContent = JSON.stringify(data);
  } catch {
    // ignore
  }
}

/**
 * Page-level hook for setting explicit SEO metadata
 */
export function usePageSEO({
  title,
  subtitle,
  description,
  keywords,
  canonicalPath,
  ogImage,
  ogType = "website",
  noIndex,
  jsonLd,
}: SEOProps) {
  const [location] = useLocation();

  useEffect(() => {
    let active = true;

    fetchSiteSettingsCached().then((settings) => {
      if (!active) return;

      const siteName = settings?.siteName || "LinkCloud";
      const defaultDesc =
        settings?.metaDescription ||
        "India's Premium WhatsApp & Telegram Community Directory. Discover verified active groups.";
      const defaultKeywords =
        settings?.metaKeywords ||
        "WhatsApp groups, Telegram channels, Discord servers, India group links";
      const detectedOrigin =
        typeof window !== "undefined" &&
        window.location.origin &&
        !window.location.origin.includes("localhost")
          ? window.location.origin
          : "https://community-link-hub.pages.dev";
      const configuredCanonical = settings?.canonicalUrl?.trim();
      const canonicalBase = (
        configuredCanonical && configuredCanonical !== "https://linkcloud.in"
          ? configuredCanonical
          : detectedOrigin
      ).replace(/\/$/, "");
      const defaultOgImage =
        settings?.ogImage || `${canonicalBase}/og-banner.png`;
      const defaultTwitterImage =
        settings?.twitterCardImage || defaultOgImage;

      // 1. Calculate Document Title
      let pageTitle = siteName;
      if (title) {
        if (title.includes(siteName)) {
          pageTitle = title;
        } else if (subtitle) {
          pageTitle = `${title} — ${subtitle} | ${siteName}`;
        } else {
          pageTitle = `${title} — ${siteName}`;
        }
      } else if (settings?.metaTitle) {
        pageTitle = settings.metaTitle;
      }
      document.title = pageTitle;

      // 2. Meta Description & Keywords
      const finalDesc = description || defaultDesc;
      const finalKeywords = keywords || defaultKeywords;
      setOrCreateMeta("description", finalDesc);
      setOrCreateMeta("keywords", finalKeywords);

      // 3. Robots Tag (Check private route vs public vs maintenance mode)
      const forceNoIndex =
        noIndex !== undefined
          ? noIndex
          : isPrivateRoute(location) || Boolean(settings?.maintenanceMode);
      if (forceNoIndex) {
        setOrCreateMeta("robots", "noindex, nofollow");
      } else {
        setOrCreateMeta("robots", "index, follow");
      }

      // 4. Canonical URL
      const currentPath = canonicalPath || location.split("?")[0];
      const fullCanonical = `${canonicalBase}${currentPath === "/" ? "" : currentPath}`;
      setOrCreateCanonical(fullCanonical);

      // 5. OpenGraph Tags
      setOrCreateMeta("og:title", pageTitle, true);
      setOrCreateMeta("og:description", finalDesc, true);
      setOrCreateMeta("og:url", fullCanonical, true);
      setOrCreateMeta("og:type", ogType, true);
      setOrCreateMeta("og:site_name", siteName, true);
      setOrCreateMeta("og:image", ogImage || defaultOgImage, true);

      // 6. Twitter Card Tags
      setOrCreateMeta("twitter:card", "summary_large_image");
      setOrCreateMeta("twitter:title", pageTitle);
      setOrCreateMeta("twitter:description", finalDesc);
      setOrCreateMeta("twitter:image", ogImage || defaultTwitterImage);

      // 7. Structured Data (JSON-LD)
      if (jsonLd) {
        setOrCreateJsonLd("page-jsonld", jsonLd);
      }
    });

    return () => {
      active = false;
    };
  }, [
    title,
    subtitle,
    description,
    keywords,
    canonicalPath,
    ogImage,
    ogType,
    noIndex,
    jsonLd,
    location,
  ]);
}

/**
 * Backwards-compatible convenience wrapper for usePageTitle
 */
export function usePageTitle(title: string, subtitle?: string, description?: string) {
  usePageSEO({ title, subtitle, description });
}

/**
 * Global SEO hook running continuously in App.tsx
 * Automatically ensures noindex on private paths, injects WebSite structured data,
 * and tracks route canonical changes.
 */
export function useGlobalSEO() {
  const [location] = useLocation();

  useEffect(() => {
    let active = true;

    fetchSiteSettingsCached().then((settings) => {
      if (!active) return;

      const canonicalBase = (
        settings?.canonicalUrl || "https://linkcloud.in"
      ).replace(/\/$/, "");
      const cleanPath = location.split("?")[0];
      const fullCanonical = `${canonicalBase}${cleanPath === "/" ? "" : cleanPath}`;

      // Enforce strict robots rule based on path
      if (isPrivateRoute(cleanPath)) {
        setOrCreateMeta("robots", "noindex, nofollow");
      } else {
        setOrCreateMeta("robots", "index, follow");
      }

      setOrCreateCanonical(fullCanonical);

      // Inject Global Schema.org WebSite JSON-LD
      if (settings?.structuredDataJson) {
        try {
          const parsed = JSON.parse(settings.structuredDataJson);
          setOrCreateJsonLd("linkcloud-global-jsonld", parsed);
        } catch {
          // Fallback if custom JSON-LD is invalid
          setOrCreateJsonLd("linkcloud-global-jsonld", {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: settings?.siteName || "LinkCloud",
            url: canonicalBase,
            description: settings?.metaDescription || "India's Public Community Directory",
            potentialAction: {
              "@type": "SearchAction",
              target: `${canonicalBase}/groups?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          });
        }
      } else {
        setOrCreateJsonLd("linkcloud-global-jsonld", {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: settings?.siteName || "LinkCloud",
          url: canonicalBase,
          description: "India's Premium Community Directory",
          potentialAction: {
            "@type": "SearchAction",
            target: `${canonicalBase}/groups?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        });
      }
    });

    return () => {
      active = false;
    };
  }, [location]);
}
