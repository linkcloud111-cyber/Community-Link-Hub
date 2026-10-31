import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSiteSettings } from "@/lib/firestore";
import type { SiteSettings } from "@/lib/types";

interface SiteSettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  effectiveTheme: "dark" | "light";
  refreshSettings: () => Promise<void>;
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "LinkCloud",
  siteTagline: "India's Community Link Directory",
  siteDescription:
    "Discover, join, and share verified WhatsApp, Telegram, Discord, Signal, Facebook, Instagram, YouTube, X, LinkedIn, and Reddit communities across India.",
  logoUrl: "",
  faviconUrl: "",
  theme: "dark",
  websiteTheme: "dark",
  contactEmail: "support@linkcloud.in",
  heroSectionEnabled: true,
  featuredGroupsEnabled: true,
  latestGroupsEnabled: true,
  popularGroupsEnabled: true,
  popularCategoriesEnabled: true,
  popularPlatformsEnabled: true,
  statisticsSectionEnabled: true,
  testimonialsEnabled: true,
  faqSectionEnabled: true,
  newsletterSectionEnabled: true,
  footerEnabled: true,
  heroButtonText: "Explore Groups",
  heroButtonLink: "/groups",
  primaryColor: "#3b82f6",
  headerTitle: "LinkCloud",
  footerDescription:
    "Discover and join India's best online communities across WhatsApp, Telegram, Discord, and more.",
  copyrightText: `© ${new Date().getFullYear()} LinkCloud. Built for Indian Communities.`,
  heroTitle: "Discover & Join India's Best Communities",
  heroSubtitle:
    "Browse verified WhatsApp groups, Telegram channels, Discord servers, and social communities across every Indian state and city.",
  searchPlaceholder:
    "Search communities by keyword, category, state, district, or city...",
  featuredSectionEnabled: true,
  categoriesSectionEnabled: true,
  platformsSectionEnabled: true,
  popularGroupsSectionEnabled: true,
  recentGroupsSectionEnabled: true,
  aboutTitle: "Connecting Communities Across India",
  aboutDescription:
    "LinkCloud is India's verified directory for discovering public WhatsApp groups, Telegram channels, Discord servers, and social hubs across every Indian state, district, and city.",
  aboutMission:
    "To empower students, professionals, local residents, and creators in every corner of India to connect safely through verified community links.",
  aboutVision:
    "Building the largest, cleanest, and safest public index of hyper-local and national digital communities in India.",
  supportEmail: "support@linkcloud.in",
  supportMobile: "+91 79874 10765",
  businessAddress: "Raipur, Chhattisgarh, India",
  officeHours: "Monday – Saturday, 10:00 AM to 6:00 PM IST",
  googleMapUrl: "",
  whatsappUrl: "",
  telegramUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  linkedinUrl: "",
  twitterUrl: "",
  redditUrl: "",
  githubUrl: "",
  privacyPolicyContent: "",
  termsContent: "",
  dmcaContent: "",
  disclaimerContent: "",
  metaTitle: "LinkCloud — India's Verified Community Link Directory",
  metaDescription:
    "Find and join verified WhatsApp groups, Telegram channels, Discord servers, and online communities across India.",
  metaKeywords:
    "whatsapp groups india, telegram channels india, discord servers india, linkcloud, indian communities",
  canonicalUrl: "https://linkcloud.in",
  ogImage: "",
  twitterCardImage: "",
  robotsTxtContent: "User-agent: *\nAllow: /\nSitemap: https://linkcloud.in/sitemap.xml",
  sitemapXmlContent: "",
  structuredDataJson: "",
  userRegistrationEnabled: true,
  googleLoginEnabled: true,
  emailLoginEnabled: true,
  mobileOtpLoginEnabled: true,
  groupSubmissionEnabled: true,
  favoritesEnabled: true,
  reportSystemEnabled: true,
  complaintSystemEnabled: true,
  contactFormEnabled: true,
  maintenanceMode: false,
  maintenanceMessage:
    "LinkCloud is currently undergoing scheduled system upgrades and database optimization. We will be back online shortly!",
  allowPublicSubmissions: false, // Documented fail-closed safe fallback
  requireApproval: true,
  filterSettings: {
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
    verifiedFilterEnabled: true,
    approvalStatusFilterEnabled: true,
  },
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

function hexToHslCssVars(hex: string): { primary: string; ring: string } | null {
  const clean = (hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  const hslStr = `${hDeg} ${sPct}% ${lPct}%`;
  return { primary: hslStr, ring: hslStr };
}

function upsertHeadMeta(selector: string, attrName: string, attrValue: string, content: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!content) {
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonicalLink(href: string) {
  if (typeof document === "undefined" || !href) return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function upsertFaviconLink(href: string) {
  if (typeof document === "undefined" || !href) return;
  let link = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function upsertStructuredDataJson(jsonRaw: string) {
  if (typeof document === "undefined") return;
  const scriptId = "lc-webmaster-jsonld";
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  const trimmed = (jsonRaw || "").trim();
  if (!trimmed) {
    if (script) script.remove();
    return;
  }
  try {
    // Validate JSON before injecting
    JSON.parse(trimmed);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = trimmed;
  } catch {
    // Ignore malformed JSON-LD while typing
  }
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  settings: DEFAULT_SITE_SETTINGS,
  loading: true,
  effectiveTheme: "dark",
  refreshSettings: async () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem("lc_cached_site_settings");
        if (cached) {
          const parsed = JSON.parse(cached);
          return { ...DEFAULT_SITE_SETTINGS, ...parsed };
        }
      } catch {
        // Ignore storage read errors
      }
    }
    return DEFAULT_SITE_SETTINGS;
  });
  const [loading, setLoading] = useState(true);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  });

  // Listen to OS/Browser color-scheme changes in real time
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mql.matches);
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const refreshSettings = async () => {
    try {
      const fresh = await getSiteSettings();
      setSettings(fresh);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("lc_cached_site_settings", JSON.stringify(fresh));
        } catch {}
      }
    } catch (err) {
      console.warn("[SiteSettings] Failed to refresh settings:", err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Firestore listener on `settings/site` + cross-tab storage sync
  useEffect(() => {
    let unsub: (() => void) | null = null;

    if (db && typeof db === "object" && "app" in db) {
      unsub = onSnapshot(
        doc(db, "settings", "site"),
        async (snap) => {
          if (snap.exists()) {
            const full = await getSiteSettings();
            setSettings(full);
            if (typeof window !== "undefined") {
              try {
                window.localStorage.setItem("lc_cached_site_settings", JSON.stringify(full));
              } catch {}
            }
            setLoading(false);
          } else {
            const fallback = await getSiteSettings();
            setSettings(fallback);
            setLoading(false);
          }
        },
        async (err) => {
          console.warn("[SiteSettings] Snapshot listener fallback:", err);
          await refreshSettings();
        }
      );
    } else {
      refreshSettings();
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "lc_cached_site_settings" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    };

    const handleCustomUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<SiteSettings>;
      if (customEvent.detail) {
        setSettings((prev) => {
          const merged = { ...prev, ...customEvent.detail };
          try {
            window.localStorage.setItem("lc_cached_site_settings", JSON.stringify(merged));
          } catch {}
          return merged;
        });
      } else {
        refreshSettings();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      window.addEventListener("lc-site-settings-updated", handleCustomUpdate);
    }

    return () => {
      if (unsub) unsub();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("lc-site-settings-updated", handleCustomUpdate);
      }
    };
  }, []);

  // Compute effective theme ('dark' | 'light')
  const effectiveTheme: "dark" | "light" = useMemo(() => {
    const raw = (settings.websiteTheme || (settings as any).theme || "dark").toLowerCase();
    if (raw === "light") return "light";
    if (raw === "system") return systemPrefersDark ? "dark" : "light";
    return "dark";
  }, [settings.websiteTheme, (settings as any).theme, systemPrefersDark]);

  // Synchronize Theme, Primary Color, Favicon, and SEO Metadata to DOM in real time
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (effectiveTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    }

    // Apply Webmaster Primary Brand Color to CSS variables
    if (settings.primaryColor) {
      const hslVars = hexToHslCssVars(settings.primaryColor);
      if (hslVars) {
        root.style.setProperty("--primary", hslVars.primary);
        root.style.setProperty("--ring", hslVars.ring);
        root.style.setProperty("--sidebar-primary", hslVars.primary);
        root.style.setProperty("--sidebar-ring", hslVars.ring);
      }
    }

    // Apply Favicon
    if (settings.faviconUrl) {
      upsertFaviconLink(settings.faviconUrl);
    }

    // Apply Global SEO / Meta Tags
    const metaDescription = settings.metaDescription || settings.siteDescription || "";
    const metaTitle =
      settings.metaTitle ||
      `${settings.siteName || "LinkCloud"} — ${settings.siteTagline || "India's Community Link Directory"}`;

    upsertHeadMeta('meta[name="description"]', "name", "description", metaDescription);
    upsertHeadMeta('meta[name="keywords"]', "name", "keywords", settings.metaKeywords || "");
    upsertHeadMeta('meta[property="og:site_name"]', "property", "og:site_name", settings.siteName || "LinkCloud");
    upsertHeadMeta('meta[property="og:title"]', "property", "og:title", metaTitle);
    upsertHeadMeta('meta[property="og:description"]', "property", "og:description", metaDescription);
    if (settings.ogImage) {
      upsertHeadMeta('meta[property="og:image"]', "property", "og:image", settings.ogImage);
    }
    upsertHeadMeta('meta[name="twitter:title"]', "name", "twitter:title", metaTitle);
    upsertHeadMeta('meta[name="twitter:description"]', "name", "twitter:description", metaDescription);
    if (settings.twitterCardImage || settings.ogImage) {
      upsertHeadMeta(
        'meta[name="twitter:image"]',
        "name",
        "twitter:image",
        settings.twitterCardImage || settings.ogImage || ""
      );
    }
    if (settings.canonicalUrl) {
      upsertCanonicalLink(settings.canonicalUrl);
    }
    upsertStructuredDataJson(settings.structuredDataJson || "");
  }, [effectiveTheme, settings]);

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        loading,
        effectiveTheme,
        refreshSettings,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
