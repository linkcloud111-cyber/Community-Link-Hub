import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSiteSettings } from "@/lib/firestore";
import { isSafePublicUrl } from "@/lib/settings-validation";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from "@/lib/default-site-settings";
import type { SiteSettings } from "@/lib/types";

interface SiteSettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  effectiveTheme: "dark" | "light";
  refreshSettings: () => Promise<void>;
}

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

function upsertFaviconLink(href: string) {
  if (typeof document === "undefined" || !href) return;
  if (!isSafePublicUrl(href, true)) return;
  let link = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href.trim());
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
          return normalizeSiteSettings(parsed);
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
        (snap) => {
          const full = snap.exists()
            ? normalizeSiteSettings(snap.data() as Partial<SiteSettings>)
            : DEFAULT_SITE_SETTINGS;
          setSettings(full);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem("lc_cached_site_settings", JSON.stringify(full));
            } catch {}
          }
          setLoading(false);
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
          setSettings((prev) => normalizeSiteSettings({ ...prev, ...parsed }));
        } catch {}
      }
    };

    const handleCustomUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<SiteSettings>;
      if (customEvent.detail) {
        setSettings((prev) => {
          const merged = normalizeSiteSettings({ ...prev, ...customEvent.detail });
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

    // Apply Favicon (supports both faviconUrl and legacy/admin favicon field)
    const activeFavicon = settings.faviconUrl || settings.favicon;
    if (activeFavicon) {
      upsertFaviconLink(activeFavicon);
    }
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
