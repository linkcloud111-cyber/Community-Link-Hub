import type { FilterSettings, SiteSettings } from "./types";

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  categoryFilterEnabled: true,
  platformFilterEnabled: true,
  contentTypeFilterEnabled: true,
  languageFilterEnabled: true,
  stateFilterEnabled: true,
  districtFilterEnabled: true,
  cityFilterEnabled: true,
  linkStatusFilterEnabled: true,
  featuredFilterEnabled: true,
  popularFilterEnabled: true,
  newestFilterEnabled: true,
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  // Website Identity & Branding
  siteName: "LinkCloud",
  siteTagline: "India's Community Link Directory",
  siteDescription:
    "Discover, join, and share verified WhatsApp, Telegram, Discord, Signal, Facebook, Instagram, YouTube, X, LinkedIn, and Reddit communities across India.",
  headerTitle: "LinkCloud",
  siteLogo: "",
  logoUrl: "",
  favicon: "",
  faviconUrl: "",
  primaryColor: "#3b82f6",
  homepageBanner: "",
  heroTitle: "Discover & Join India's Best Communities",
  heroSubtitle:
    "Browse verified WhatsApp groups, Telegram channels, Discord servers, and social communities across every Indian state and city.",
  searchPlaceholder:
    "Search communities by keyword, category, state, district, or city...",
  heroButtonText: "Explore Groups",
  heroButtonLink: "/groups",
  footerLogo: "",
  footerDescription:
    "Discover and join India's best online communities across WhatsApp, Telegram, Discord, and more.",
  copyrightText: "© 2026 LinkCloud. Built for Indian Communities.",
  websiteTheme: "dark",
  theme: "dark",
  maintenanceMode: false,
  maintenanceMessage:
    "LinkCloud is currently undergoing scheduled system upgrades and database optimization. We will be back online shortly!",

  // Contact Info (neutral placeholders; empty optional values stay hidden on Contact/Footer)
  contactEmail: "",
  officialContactEmail: "",
  supportEmail: "",
  supportMobile: "",
  whatsappContactNumber: "",
  businessAddress: "",
  city: "",
  district: "",
  state: "",
  pinCode: "",
  country: "India",
  officialWebsiteUrl: "",
  officeHours: "",

  // Granular Contact Visibility Switches
  showContactEmail: true,
  showSupportEmail: true,
  showPhoneNumber: true,
  showWhatsAppContact: true,
  showAddress: true,
  showCompleteContactSection: true,
  showContactInFooter: true,
  showContactOnContactPage: true,

  // Official Social Links (blank by default until Owner configures verified handles)
  whatsappUrl: "",
  telegramUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  linkedinUrl: "",
  twitterUrl: "",
  redditUrl: "",
  githubUrl: "",

  // Homepage Sections
  heroSectionEnabled: true,
  featuredGroupsEnabled: true,
  latestGroupsEnabled: true,
  popularGroupsEnabled: true,
  popularCategoriesEnabled: true,
  popularPlatformsEnabled: true,
  statisticsSectionEnabled: true,
  faqSectionEnabled: true,
  footerEnabled: true,

  // Global SEO & Open Graph Defaults
  metaTitle: "LinkCloud — India's Verified Community Link Directory",
  metaDescription:
    "Discover and join verified WhatsApp groups, Telegram channels, Discord servers, and online communities across India.",
  metaKeywords:
    "whatsapp groups india, telegram channels india, discord servers india, linkcloud, indian communities",
  canonicalUrl: "",
  ogTitle: "LinkCloud — Join India's Verified Communities",
  ogDescription:
    "Discover active communities across WhatsApp, Telegram, Discord, and regional Indian hubs.",
  ogImage: "",
  twitterCardTitle: "LinkCloud — India's Community Directory",
  twitterCardDescription:
    "Find verified WhatsApp groups, Telegram channels, and Discord servers across India.",
  twitterCardImage: "",
  structuredDataJson: JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "LinkCloud",
      url: "https://community-link-hub.pages.dev",
    },
    null,
    2
  ),
  allowIndexing: true,
  googleSiteVerification: "",

  // System Master Toggles (submission flags fail closed by default)
  allowPublicSubmissions: false,
  groupSubmissionEnabled: false,
  requireApproval: true,
  autoApproveGroups: false,
  requireGroupLogo: false,
  groupNameMaxLength: 100,
  groupTaglineMaxLength: 120,
  groupDescriptionMaxLength: 500,
  groupRulesMaxLength: 1000,
  maxTagsPerGroup: 10,
  userRegistrationEnabled: true,
  googleLoginEnabled: true,
  emailLoginEnabled: true,
  mobileOtpLoginEnabled: true,
  favoritesEnabled: true,
  reportSystemEnabled: true,
  complaintSystemEnabled: true,
  contactFormEnabled: true,
  announcementsEnabled: true,
  searchEnabled: true,
  publicDirectoryEnabled: true,
  profileEditingEnabled: true,

  // Filter Settings (active directory filters only)
  filterSettings: { ...DEFAULT_FILTER_SETTINGS },

  // Cloudinary Integration (disabled/blank until configured by Webmaster)
  cloudinaryCloudName: "",
  cloudinaryUploadPreset: "",
  cloudinarySettings: {
    enabled: false,
    cloudName: "",
    uploadPreset: "",
    apiKey: "",
    assetFolder: "linkcloud/logos",
    maxFileSizeMb: 2,
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
  },
};

/**
 * Normalizes any raw `settings/site` Firestore document against canonical defaults
 * while keeping legacy field aliases bidirectionally synchronized.
 */
export function normalizeSiteSettings(raw?: Partial<SiteSettings> | null): SiteSettings {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;

  const hasSupportEmail = typeof input.supportEmail === "string";
  const hasLegacyContactEmail = typeof input.contactEmail === "string";
  const normalizedSupportEmail = hasSupportEmail
    ? input.supportEmail.trim()
    : hasLegacyContactEmail
    ? input.contactEmail.trim()
    : "";

  const normalizedOfficialContactEmail =
    typeof input.officialContactEmail === "string"
      ? input.officialContactEmail.trim()
      : hasLegacyContactEmail && hasSupportEmail && input.contactEmail.trim() !== input.supportEmail.trim()
      ? input.contactEmail.trim()
      : "";

  const normalizedContactEmailAlias = normalizedSupportEmail || normalizedOfficialContactEmail || "";

  const normalizedLogo =
    (typeof input.logoUrl === "string" && input.logoUrl.trim()) ||
    (typeof input.siteLogo === "string" && input.siteLogo.trim()) ||
    "";

  const normalizedFavicon =
    (typeof input.faviconUrl === "string" && input.faviconUrl.trim()) ||
    (typeof input.favicon === "string" && input.favicon.trim()) ||
    "";

  const normalizedTheme =
    input.websiteTheme || input.theme || DEFAULT_SITE_SETTINGS.websiteTheme;

  const rawCloudName =
    (typeof input.cloudinarySettings?.cloudName === "string" && input.cloudinarySettings.cloudName.trim()) ||
    (typeof input.cloudinaryCloudName === "string" && input.cloudinaryCloudName.trim()) ||
    "";

  const rawUploadPreset =
    (typeof input.cloudinarySettings?.uploadPreset === "string" && input.cloudinarySettings.uploadPreset.trim()) ||
    (typeof input.cloudinaryUploadPreset === "string" && input.cloudinaryUploadPreset.trim()) ||
    "";

  const rawFilterSettings = (input.filterSettings && typeof input.filterSettings === "object"
    ? input.filterSettings
    : {}) as Record<string, any>;

  const filterSettings: FilterSettings = {
    categoryFilterEnabled: rawFilterSettings.categoryFilterEnabled ?? DEFAULT_FILTER_SETTINGS.categoryFilterEnabled,
    platformFilterEnabled: rawFilterSettings.platformFilterEnabled ?? DEFAULT_FILTER_SETTINGS.platformFilterEnabled,
    contentTypeFilterEnabled: rawFilterSettings.contentTypeFilterEnabled ?? DEFAULT_FILTER_SETTINGS.contentTypeFilterEnabled,
    languageFilterEnabled: rawFilterSettings.languageFilterEnabled ?? DEFAULT_FILTER_SETTINGS.languageFilterEnabled,
    stateFilterEnabled: rawFilterSettings.stateFilterEnabled ?? DEFAULT_FILTER_SETTINGS.stateFilterEnabled,
    districtFilterEnabled: rawFilterSettings.districtFilterEnabled ?? DEFAULT_FILTER_SETTINGS.districtFilterEnabled,
    cityFilterEnabled: rawFilterSettings.cityFilterEnabled ?? DEFAULT_FILTER_SETTINGS.cityFilterEnabled,
    linkStatusFilterEnabled: rawFilterSettings.linkStatusFilterEnabled ?? DEFAULT_FILTER_SETTINGS.linkStatusFilterEnabled,
    featuredFilterEnabled: rawFilterSettings.featuredFilterEnabled ?? DEFAULT_FILTER_SETTINGS.featuredFilterEnabled,
    popularFilterEnabled: rawFilterSettings.popularFilterEnabled ?? DEFAULT_FILTER_SETTINGS.popularFilterEnabled,
    newestFilterEnabled: rawFilterSettings.newestFilterEnabled ?? DEFAULT_FILTER_SETTINGS.newestFilterEnabled,
  };

  const autoApprove =
    typeof input.autoApproveGroups === "boolean"
      ? input.autoApproveGroups
      : typeof input.requireApproval === "boolean"
      ? !input.requireApproval
      : false;
  const requireApproval =
    typeof input.requireApproval === "boolean" ? input.requireApproval : !autoApprove;

  const clampNum = (val: unknown, fallback: number, min: number, max: number) => {
    const n = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  const cleanText = (val: unknown, fallback = "") =>
    typeof val === "string" ? val.trim() : fallback;

  const merged: SiteSettings = {
    ...DEFAULT_SITE_SETTINGS,
    ...(input as Partial<SiteSettings>),
    supportEmail: normalizedSupportEmail,
    officialContactEmail: normalizedOfficialContactEmail,
    contactEmail: normalizedContactEmailAlias,
    supportMobile: cleanText(input.supportMobile),
    whatsappContactNumber: cleanText(input.whatsappContactNumber),
    businessAddress: cleanText(input.businessAddress),
    city: cleanText(input.city),
    district: cleanText(input.district),
    state: cleanText(input.state),
    pinCode: cleanText(input.pinCode),
    country: typeof input.country === "string" ? input.country.trim() : DEFAULT_SITE_SETTINGS.country,
    officialWebsiteUrl: cleanText(input.officialWebsiteUrl),
    officeHours: cleanText(input.officeHours),
    showContactEmail: input.showContactEmail !== false,
    showSupportEmail: input.showSupportEmail !== false,
    showPhoneNumber: input.showPhoneNumber !== false,
    showWhatsAppContact: input.showWhatsAppContact !== false,
    showAddress: input.showAddress !== false,
    showCompleteContactSection: input.showCompleteContactSection !== false,
    showContactInFooter: input.showContactInFooter !== false,
    showContactOnContactPage: input.showContactOnContactPage !== false,
    siteLogo: normalizedLogo,
    logoUrl: normalizedLogo,
    favicon: normalizedFavicon,
    faviconUrl: normalizedFavicon,
    websiteTheme: normalizedTheme,
    theme: normalizedTheme,
    allowIndexing: input.allowIndexing !== false,
    allowPublicSubmissions: false,
    groupSubmissionEnabled: input.groupSubmissionEnabled === true,
    autoApproveGroups: autoApprove,
    requireApproval,
    requireGroupLogo: input.requireGroupLogo === true,
    groupNameMaxLength: clampNum(input.groupNameMaxLength, 100, 30, 150),
    groupTaglineMaxLength: clampNum(input.groupTaglineMaxLength, 120, 30, 200),
    groupDescriptionMaxLength: clampNum(input.groupDescriptionMaxLength, 500, 100, 2000),
    groupRulesMaxLength: clampNum(input.groupRulesMaxLength, 1000, 100, 2000),
    maxTagsPerGroup: clampNum(input.maxTagsPerGroup, 10, 1, 25),
    filterSettings,
    cloudinaryCloudName: rawCloudName,
    cloudinaryUploadPreset: rawUploadPreset,
    cloudinarySettings: {
      ...DEFAULT_SITE_SETTINGS.cloudinarySettings,
      ...(input.cloudinarySettings || {}),
      enabled:
        typeof input.cloudinarySettings?.enabled === "boolean"
          ? input.cloudinarySettings.enabled
          : Boolean(rawCloudName && rawUploadPreset),
      cloudName: rawCloudName,
      uploadPreset: rawUploadPreset,
    },
  };

  return merged;
}

export interface MissingSettingsPatchResult {
  dryRun: boolean;
  missingKeys: string[];
  patch: Record<string, any>;
}

/**
 * Idempotently computes missing keys for `settings/site` without overwriting any
 * existing Webmaster values. Defaults to `dryRun: true` so nothing writes unless explicitly authorized.
 */
export function computeMissingSettingsDefaults(
  existing?: Record<string, any> | null,
  options: { dryRun?: boolean } = {}
): MissingSettingsPatchResult {
  const dryRun = options.dryRun !== false;
  const source = existing && typeof existing === "object" ? existing : {};
  const patch: Record<string, any> = {};
  const missingKeys: string[] = [];

  for (const [key, defaultValue] of Object.entries(DEFAULT_SITE_SETTINGS)) {
    if (source[key] === undefined) {
      missingKeys.push(key);
      patch[key] = defaultValue;
    } else if (
      key === "filterSettings" &&
      source.filterSettings &&
      typeof source.filterSettings === "object"
    ) {
      const missingFilterPatch: Record<string, boolean> = {};
      for (const [fKey, fVal] of Object.entries(DEFAULT_FILTER_SETTINGS)) {
        if (source.filterSettings[fKey] === undefined) {
          missingFilterPatch[fKey] = fVal;
          missingKeys.push(`filterSettings.${fKey}`);
        }
      }
      if (Object.keys(missingFilterPatch).length > 0) {
        patch.filterSettings = { ...source.filterSettings, ...missingFilterPatch };
      }
    } else if (
      key === "cloudinarySettings" &&
      source.cloudinarySettings &&
      typeof source.cloudinarySettings === "object"
    ) {
      const missingCloudPatch: Record<string, any> = {};
      for (const [cKey, cVal] of Object.entries(DEFAULT_SITE_SETTINGS.cloudinarySettings || {})) {
        if (source.cloudinarySettings[cKey] === undefined) {
          missingCloudPatch[cKey] = cVal;
          missingKeys.push(`cloudinarySettings.${cKey}`);
        }
      }
      if (Object.keys(missingCloudPatch).length > 0) {
        patch.cloudinarySettings = { ...source.cloudinarySettings, ...missingCloudPatch };
      }
    }
  }

  return { dryRun, missingKeys, patch };
}
