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
  "testimonialsEnabled",
  "newsletterSectionEnabled",
  "notificationsEnabled",
  "googleMapUrl",
  "robotsTxtContent",
  "sitemapXmlContent",
  "featuredSectionEnabled",
  "categoriesSectionEnabled",
  "platformsSectionEnabled",
  "popularGroupsSectionEnabled",
  "recentGroupsSectionEnabled",
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
  "officialWebsiteUrl",
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

export const OFFICIAL_CANONICAL_ORIGIN = "https://community-link-hub.pages.dev";

const UNVERIFIED_LEGACY_HOSTS = new Set(["linkcloud.in", "www.linkcloud.in"]);

export function extractHostnameFromCandidate(candidate?: string | null): string {
  if (!candidate || typeof candidate !== "string") return "";
  const trimmed = candidate.trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isUnverifiedLegacyDomain(candidate?: string | null): boolean {
  const host = extractHostnameFromCandidate(candidate);
  return Boolean(host && UNVERIFIED_LEGACY_HOSTS.has(host));
}

function isEphemeralOrLocalHost(candidate?: string | null): boolean {
  const host = extractHostnameFromCandidate(candidate);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
  if (
    host.endsWith(".run.app") ||
    host.endsWith(".replit.dev") ||
    host.endsWith(".repl.co") ||
    host.endsWith(".community-link-hub.pages.dev")
  ) {
    return true;
  }
  return false;
}

function normalizeAbsoluteHttpOrigin(candidate?: string | null): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed || hasDisallowedUrlScheme(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * Resolves the active canonical origin consistently across Browser, Vite dev, and Cloudflare Functions.
 * Ensures unverified legacy linkcloud.in settings and ephemeral preview/sandbox hosts are not emitted
 * while live production traffic runs on community-link-hub.pages.dev, unless actively served on linkcloud.in.
 */
export function resolveActiveCanonicalOrigin(options: {
  configuredCanonicalUrl?: string | null;
  envOrigin?: string | null;
  runtimeOrigin?: string | null;
  requestUrl?: string | null;
  hostHeader?: string | null;
  forwardedProto?: string | null;
}): string {
  const fromRuntime = normalizeAbsoluteHttpOrigin(options.runtimeOrigin);
  const fromRequestUrl = normalizeAbsoluteHttpOrigin(options.requestUrl);
  let fromHostHeader: string | null = null;
  const rawHost = (options.hostHeader || "").trim();
  if (rawHost) {
    const proto =
      options.forwardedProto?.split(",")[0]?.trim() ||
      (rawHost.includes("localhost") || rawHost.startsWith("127.0.0.1") ? "http" : "https");
    fromHostHeader = normalizeAbsoluteHttpOrigin(`${proto}://${rawHost}`);
  }

  const activeHostOrigin = fromRuntime || fromRequestUrl || fromHostHeader;
  const activeHostIsLegacy = isUnverifiedLegacyDomain(activeHostOrigin);

  const fromConfigured = normalizeAbsoluteHttpOrigin(options.configuredCanonicalUrl);
  if (fromConfigured && !isEphemeralOrLocalHost(fromConfigured)) {
    if (!isUnverifiedLegacyDomain(fromConfigured) || activeHostIsLegacy) {
      return fromConfigured;
    }
  }

  const fromEnv = normalizeAbsoluteHttpOrigin(options.envOrigin);
  if (
    fromEnv &&
    !isEphemeralOrLocalHost(fromEnv) &&
    (!isUnverifiedLegacyDomain(fromEnv) || activeHostIsLegacy)
  ) {
    return fromEnv;
  }

  if (
    activeHostOrigin &&
    !isEphemeralOrLocalHost(activeHostOrigin) &&
    (!isUnverifiedLegacyDomain(activeHostOrigin) || activeHostIsLegacy)
  ) {
    return activeHostOrigin;
  }

  return OFFICIAL_CANONICAL_ORIGIN;
}

export function normalizeHttpBaseUrl(rawUrl?: string, fallback = ""): string {
  const trimmed = (rawUrl || "").trim();
  if (trimmed && isSafePublicUrl(trimmed, false)) {
    return trimmed.replace(/\/+$/, "");
  }
  if (fallback) {
    return fallback.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "";
}

/**
 * Resolves a canonical URL safely supporting both full http(s) URLs and same-site relative paths
 * (including intentional allowlisted query strings such as /groups?category=other when explicitly passed).
 */
export function resolveCanonicalUrl(
  pageCanonical: string | undefined,
  canonicalBase: string,
  fallbackPath: string
): string {
  const cleanBase = normalizeHttpBaseUrl(canonicalBase, OFFICIAL_CANONICAL_ORIGIN);
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
          if (isUnverifiedLegacyDomain(parsed.hostname) && !isUnverifiedLegacyDomain(cleanBase)) {
            const pathWithSearch = `${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`;
            return `${cleanBase}${pathWithSearch || ""}`;
          }
          return parsed.toString();
        }
      } catch {
        // fallback below
      }
    } else if (rawPage.startsWith("/") && !rawPage.startsWith("//")) {
      const cleanRel = rawPage.split("#")[0] || "/";
      return `${cleanBase}${cleanRel === "/" ? "" : cleanRel}`;
    }
  }

  return `${cleanBase}${cleanFallbackPath === "/" ? "" : cleanFallbackPath}`;
}

export function resolveSeoImageUrl(rawImage: string | undefined, canonicalBase: string): string {
  const trimmed = (rawImage || "").trim();
  if (!trimmed || hasDisallowedUrlScheme(trimmed)) return "";
  const safeBase = normalizeHttpBaseUrl(canonicalBase, OFFICIAL_CANONICAL_ORIGIN);
  if (/^https?:\/\//i.test(trimmed)) {
    if (!isSafePublicUrl(trimmed, false)) return "";
    if (isUnverifiedLegacyDomain(trimmed) && !isUnverifiedLegacyDomain(safeBase)) {
      return "";
    }
    return trimmed;
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return `${safeBase}${trimmed}`;
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
  { field: "officialContactEmail", label: "Official Contact Email", max: 160 },
  { field: "supportEmail", label: "Support Email", max: 160 },
  { field: "supportMobile", label: "Support Mobile Number", max: 30 },
  { field: "whatsappContactNumber", label: "WhatsApp Contact Number", max: 30 },
  { field: "businessAddress", label: "Street / Office Address", max: 300 },
  { field: "city", label: "City", max: 80 },
  { field: "district", label: "District", max: 80 },
  { field: "state", label: "State", max: 80 },
  { field: "pinCode", label: "PIN Code", max: 12 },
  { field: "country", label: "Country", max: 80 },
  { field: "officeHours", label: "Office Working Hours", max: 120 },
  { field: "googleSiteVerification", label: "Google Site Verification Token", max: 200 },
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

  if (sanitized.filterSettings && typeof sanitized.filterSettings === "object") {
    const cleanFilters = { ...sanitized.filterSettings };
    delete cleanFilters.verifiedFilterEnabled;
    delete cleanFilters.approvalStatusFilterEnabled;
    sanitized.filterSettings = cleanFilters;
  }

  // Validate & normalize optional contact fields cleanly (allow clearing without fake defaults)
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof sanitized.supportEmail === "string") {
    const trimmedSupport = sanitized.supportEmail.trim();
    if (trimmedSupport && !emailPattern.test(trimmedSupport)) {
      return { valid: false, error: "Support Email must be a valid email address or left blank." };
    }
    sanitized.supportEmail = trimmedSupport;
  }
  if (typeof sanitized.officialContactEmail === "string") {
    const trimmedOfficial = sanitized.officialContactEmail.trim();
    if (trimmedOfficial && !emailPattern.test(trimmedOfficial)) {
      return { valid: false, error: "Official Contact Email must be a valid email address or left blank." };
    }
    sanitized.officialContactEmail = trimmedOfficial;
  }
  if (typeof sanitized.contactEmail === "string") {
    const trimmedContact = sanitized.contactEmail.trim();
    if (trimmedContact && !emailPattern.test(trimmedContact)) {
      return { valid: false, error: "Contact Email must be a valid email address or left blank." };
    }
    sanitized.contactEmail = trimmedContact;
  }

  if (typeof sanitized.supportEmail === "string" || typeof sanitized.officialContactEmail === "string") {
    sanitized.contactEmail =
      (typeof sanitized.supportEmail === "string" ? sanitized.supportEmail : "") ||
      (typeof sanitized.officialContactEmail === "string" ? sanitized.officialContactEmail : "") ||
      "";
  }

  for (const trimField of [
    "supportMobile",
    "whatsappContactNumber",
    "businessAddress",
    "city",
    "district",
    "state",
    "pinCode",
    "country",
    "officeHours",
  ]) {
    if (typeof sanitized[trimField] === "string") {
      sanitized[trimField] = sanitized[trimField].trim();
    }
  }

  if (typeof sanitized.googleSiteVerification === "string") {
    let rawToken = sanitized.googleSiteVerification.trim();
    const contentMatch = rawToken.match(/content=["']([^"']+)["']/i);
    if (contentMatch && contentMatch[1]) {
      rawToken = contentMatch[1].trim();
    }
    if (rawToken && !/^[A-Za-z0-9_-]{8,160}$/.test(rawToken)) {
      return {
        valid: false,
        error: "Google Site Verification token must contain only valid verification characters or be left blank.",
      };
    }
    sanitized.googleSiteVerification = rawToken;
  }

  if (typeof sanitized.pinCode === "string" && sanitized.pinCode.length > 0) {
    if (!/^[A-Za-z0-9\s-]{4,12}$/.test(sanitized.pinCode)) {
      return { valid: false, error: "PIN / Postal Code must be 4 to 12 alphanumeric characters." };
    }
  }

  for (const visKey of [
    "showContactEmail",
    "showSupportEmail",
    "showPhoneNumber",
    "showWhatsAppContact",
    "showAddress",
    "showCompleteContactSection",
    "showContactInFooter",
    "showContactOnContactPage",
  ]) {
    if (sanitized[visKey] !== undefined) {
      sanitized[visKey] = sanitized[visKey] !== false;
    }
  }

  if (sanitized.cloudinarySettings && typeof sanitized.cloudinarySettings === "object") {
    const cloudName = String(
      sanitized.cloudinarySettings.cloudName ?? sanitized.cloudinaryCloudName ?? ""
    ).trim();
    const uploadPreset = String(
      sanitized.cloudinarySettings.uploadPreset ?? sanitized.cloudinaryUploadPreset ?? ""
    ).trim();
    sanitized.cloudinaryCloudName = cloudName;
    sanitized.cloudinaryUploadPreset = uploadPreset;
    sanitized.cloudinarySettings = {
      ...sanitized.cloudinarySettings,
      enabled: sanitized.cloudinarySettings.enabled !== false && Boolean(cloudName && uploadPreset),
      cloudName,
      uploadPreset,
    };
  }

  // Validate & sync group submission limits and approval switches
  if (typeof sanitized.autoApproveGroups === "boolean" && typeof sanitized.requireApproval !== "boolean") {
    sanitized.requireApproval = !sanitized.autoApproveGroups;
  } else if (typeof sanitized.requireApproval === "boolean" && typeof sanitized.autoApproveGroups !== "boolean") {
    sanitized.autoApproveGroups = !sanitized.requireApproval;
  } else if (typeof sanitized.autoApproveGroups === "boolean" && typeof sanitized.requireApproval === "boolean") {
    // Prefer autoApproveGroups if both were toggled consistently; keep requireApproval inverse if equal
    if (sanitized.autoApproveGroups === sanitized.requireApproval) {
      sanitized.requireApproval = !sanitized.autoApproveGroups;
    }
  }

  const GROUP_NUMERIC_LIMITS: Array<{ field: string; label: string; min: number; max: number }> = [
    { field: "groupNameMaxLength", label: "Group Name Max Length", min: 30, max: 150 },
    { field: "groupTaglineMaxLength", label: "Group Tagline Max Length", min: 30, max: 200 },
    { field: "groupDescriptionMaxLength", label: "Group Description Max Length", min: 100, max: 2000 },
    { field: "groupRulesMaxLength", label: "Group Rules Max Length", min: 100, max: 2000 },
    { field: "maxTagsPerGroup", label: "Max Tags Per Group", min: 1, max: 25 },
  ];

  for (const numRule of GROUP_NUMERIC_LIMITS) {
    if (sanitized[numRule.field] !== undefined) {
      const parsedNum = Number(sanitized[numRule.field]);
      if (!Number.isFinite(parsedNum) || parsedNum < numRule.min || parsedNum > numRule.max) {
        return {
          valid: false,
          error: `${numRule.label} must be between ${numRule.min} and ${numRule.max}.`,
        };
      }
      sanitized[numRule.field] = Math.round(parsedNum);
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
