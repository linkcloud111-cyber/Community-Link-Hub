/**
 * Shared Isomorphic Validation & URL Resolution for LinkCloud Webmaster Settings
 * Used identically by Browser UI, Node/Vite Admin API, and Cloudflare Pages Functions.
 */

export const FORBIDDEN_SETTINGS_KEYS = [
  "role",
  "roles",
  "uid",
  "accountUid",
  "isAdmin",
  "isWebmaster",
  "permissions",
  "password",
  "salt",
  "token",
] as const;

/**
 * Legacy projection fields owned exclusively by CMS Pages Manager publish workflows.
 * Stripped from global /api/admin/settings writes so saving global site/SEO settings
 * can never overwrite CMS-published projections, while preserving legacy Firestore data
 * untouched via merge:true.
 */
export const LEGACY_CMS_MANAGED_SETTINGS_KEYS = [
  "privacyPolicyContent",
  "termsContent",
  "dmcaContent",
  "disclaimerContent",
  "aboutTitle",
  "aboutDescription",
  "aboutMission",
  "aboutVision",
  "aboutUsContent",
  "aboutFeatures",
] as const;

export const SETTINGS_RELATIVE_OR_HTTP_URL_FIELDS = [
  "ogImage",
  "twitterCardImage",
  "siteLogo",
  "logoUrl",
  "favicon",
  "faviconUrl",
  "heroButtonLink",
  "homepageBanner",
  "footerLogo",
] as const;

export const SETTINGS_HTTP_URL_FIELDS = [
  "canonicalUrl",
  "googleMapUrl",
  "facebookUrl",
  "instagramUrl",
  "telegramUrl",
  "whatsappUrl",
  "youtubeUrl",
  "linkedinUrl",
  "twitterUrl",
  "redditUrl",
  "githubUrl",
] as const;

const DISALLOWED_PROTOCOL_PREFIXES = [
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
];

export function hasDisallowedUrlScheme(rawUrl: string): boolean {
  const collapsed = rawUrl.replace(/[\x00-\x1F\x7F\s]+/g, "").toLowerCase();
  if (DISALLOWED_PROTOCOL_PREFIXES.some((p) => collapsed.startsWith(p))) {
    return true;
  }
  try {
    const decoded = decodeURIComponent(collapsed)
      .replace(/[\x00-\x1F\x7F\s]+/g, "")
      .toLowerCase();
    if (DISALLOWED_PROTOCOL_PREFIXES.some((p) => decoded.startsWith(p))) {
      return true;
    }
  } catch {
    // Malformed percent encoding alone does not prove disallowed scheme unless parsed below fails
  }
  return false;
}

export function isSafePublicUrl(rawUrl: string, allowRelative: boolean): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return true;
  if (hasDisallowedUrlScheme(trimmed)) return false;

  if (allowRelative && trimmed.startsWith("/")) {
    // Reject protocol-relative //evil.com redirects
    return !trimmed.startsWith("//");
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeHttpBaseUrl(rawUrl?: string, fallback = "https://linkcloud.in"): string {
  const trimmed = (rawUrl || "").trim();
  if (trimmed && isSafePublicUrl(trimmed, false)) {
    return trimmed.replace(/\/+$/, "");
  }
  return fallback.replace(/\/+$/, "");
}

/**
 * Resolves a canonical URL safely supporting both full http(s) URLs and same-site relative paths.
 */
export function resolveCanonicalUrl(
  pageCanonical: string | undefined,
  canonicalBase: string,
  fallbackPath: string
): string {
  const cleanBase = normalizeHttpBaseUrl(canonicalBase);
  const cleanFallbackPath =
    fallbackPath && fallbackPath.startsWith("/") && !fallbackPath.startsWith("//")
      ? fallbackPath.split("?")[0].split("#")[0] || "/"
      : "/";

  const rawPage = (pageCanonical || "").trim();
  if (rawPage && !hasDisallowedUrlScheme(rawPage)) {
    if (/^https?:\/\//i.test(rawPage)) {
      try {
        const parsed = new URL(rawPage);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        // fallback below
      }
    } else if (rawPage.startsWith("/") && !rawPage.startsWith("//")) {
      return `${cleanBase}${rawPage === "/" ? "" : rawPage}`;
    }
  }

  return `${cleanBase}${cleanFallbackPath === "/" ? "" : cleanFallbackPath}`;
}

export function resolveSeoImageUrl(rawImage: string | undefined, canonicalBase: string): string {
  const trimmed = (rawImage || "").trim();
  if (!trimmed || hasDisallowedUrlScheme(trimmed)) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return isSafePublicUrl(trimmed, false) ? trimmed : "";
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return `${normalizeHttpBaseUrl(canonicalBase)}${trimmed}`;
  }
  return "";
}

export interface SettingsValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: Record<string, any>;
}

const STRING_LENGTH_LIMITS: Array<{ field: string; label: string; max: number }> = [
  { field: "siteName", label: "Website Name", max: 120 },
  { field: "siteTagline", label: "Site Tagline", max: 240 },
  { field: "metaTitle", label: "Meta Title", max: 200 },
  { field: "metaDescription", label: "Meta Description", max: 500 },
  { field: "metaKeywords", label: "Meta Keywords", max: 500 },
  { field: "ogTitle", label: "Open Graph Title", max: 200 },
  { field: "ogDescription", label: "Open Graph Description", max: 500 },
  { field: "twitterCardTitle", label: "Twitter Card Title", max: 200 },
  { field: "twitterCardDescription", label: "Twitter Card Description", max: 500 },
  { field: "maintenanceMessage", label: "Maintenance Notice", max: 300 },
  { field: "robotsTxtContent", label: "robots.txt Template", max: 10000 },
  { field: "sitemapXmlContent", label: "sitemap.xml Template", max: 100000 },
  { field: "structuredDataJson", label: "Structured Data (JSON-LD)", max: 50000 },
];

export function validateAdminSettingsPayload(rawBody: any): SettingsValidationResult {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return { valid: false, error: "Malformed payload: Expected JSON object." };
  }

  const sanitized: Record<string, any> = { ...rawBody };

  for (const key of FORBIDDEN_SETTINGS_KEYS) {
    if (key in sanitized) {
      delete sanitized[key];
    }
  }

  for (const key of LEGACY_CMS_MANAGED_SETTINGS_KEYS) {
    if (key in sanitized) {
      delete sanitized[key];
    }
  }

  // Enforce consistent string length limits
  for (const rule of STRING_LENGTH_LIMITS) {
    const val = sanitized[rule.field];
    if (typeof val === "string" && val.length > rule.max) {
      return {
        valid: false,
        error: `${rule.label} cannot exceed ${rule.max} characters.`,
      };
    }
  }

  // Validate Structured Data (JSON-LD)
  if (typeof sanitized.structuredDataJson === "string" && sanitized.structuredDataJson.trim().length > 0) {
    try {
      JSON.parse(sanitized.structuredDataJson);
    } catch (parseErr: any) {
      return {
        valid: false,
        error: `Invalid JSON syntax in structuredDataJson: ${parseErr?.message || "Invalid JSON"}`,
      };
    }
  }

  // Validate URL fields that accept relative paths or http(s) URLs
  for (const field of SETTINGS_RELATIVE_OR_HTTP_URL_FIELDS) {
    const val = sanitized[field];
    if (typeof val === "string" && val.trim().length > 0) {
      if (!isSafePublicUrl(val, true)) {
        return {
          valid: false,
          error: `Disallowed or invalid URL in field '${field}'. Use a relative path (/...) or http(s):// URL.`,
        };
      }
      sanitized[field] = val.trim();
    }
  }

  // Validate strict http(s) URL fields (including canonicalUrl base)
  for (const field of SETTINGS_HTTP_URL_FIELDS) {
    const val = sanitized[field];
    if (typeof val === "string" && val.trim().length > 0) {
      if (!isSafePublicUrl(val, false)) {
        return {
          valid: false,
          error:
            field === "canonicalUrl"
              ? "Canonical URL Base must be a valid http:// or https:// URL."
              : `Invalid or disallowed URL protocol in field '${field}'. Must be http:// or https://.`,
        };
      }
      sanitized[field] = field === "canonicalUrl" ? val.trim().replace(/\/+$/, "") : val.trim();
    }
  }

  return { valid: true, sanitized };
}
