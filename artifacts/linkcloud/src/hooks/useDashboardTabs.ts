import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export type DashboardTab =
  | "overview"
  | "groups"
  | "my-groups"
  | "submitted"
  | "favorites"
  | "notifications"
  | "messages"
  | "contact"
  | "activity"
  | "my-activity"
  | "complaint"
  | "help"
  | "profile"
  | "my-profile"
  | "settings"
  | "profile-settings"
  | "connected-accounts"
  | "change-password"
  | "security"
  | "more";

export const VALID_DASHBOARD_TABS: readonly DashboardTab[] = [
  "overview",
  "groups",
  "my-groups",
  "submitted",
  "favorites",
  "notifications",
  "messages",
  "contact",
  "activity",
  "my-activity",
  "complaint",
  "help",
  "profile",
  "my-profile",
  "settings",
  "profile-settings",
  "connected-accounts",
  "change-password",
  "security",
  "more",
];

function resolveTabFromUrl(defaultTab: DashboardTab = "overview"): DashboardTab {
  if (typeof window === "undefined") return defaultTab;

  const pathname = window.location.pathname;
  if (pathname === "/favorites") return "favorites";
  if (pathname === "/notifications") return "notifications";
  if (pathname === "/my-profile" || pathname === "/profile") return "profile";
  if (pathname === "/profile-settings" || pathname === "/settings") return "settings";
  if (pathname === "/change-password" || pathname === "/webmaster/change-password") return "security";
  if (pathname === "/account-security" || pathname === "/webmaster/security" || pathname === "/security") return "security";
  if (pathname === "/my-groups" || pathname === "/submitted-groups" || pathname === "/my-submitted-groups" || pathname === "/webmaster/my-groups") return "my-groups";
  if (pathname === "/messages" || pathname === "/contact") return "messages";
  if (pathname === "/activity") return "activity";
  if (pathname === "/help") return "help";
  if (pathname === "/complaint") return "complaint";

  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get("tab");

  if (tabParam) {
    if (tabParam === "my-groups" || tabParam === "groups" || tabParam === "submitted" || tabParam === "my-submitted-groups") return "my-groups";
    if (tabParam === "account-security" || tabParam === "change-password") return "security";
    if (tabParam === "contact" || tabParam === "contact-webmaster") return "messages";
    if (tabParam === "my-activity") return "activity";
    if (tabParam === "report-problem") return "complaint";
    if (tabParam === "my-profile") return "profile";
    if (tabParam === "profile-settings") return "settings";
    if (tabParam === "more") return "more";
    if ((VALID_DASHBOARD_TABS as readonly string[]).includes(tabParam)) {
      return tabParam as DashboardTab;
    }
    // Invalid tab fallback
    return "overview";
  }

  return defaultTab;
}

export function useDashboardTabs(defaultTab: DashboardTab = "overview") {
  const [location, setLocation] = useLocation();
  const [currentTab, setCurrentTab] = useState<DashboardTab>(() => resolveTabFromUrl(defaultTab));

  // Keep currentTab synchronized with window.location and popstate
  useEffect(() => {
    const handleSync = () => {
      setCurrentTab(resolveTabFromUrl(defaultTab));
    };

    handleSync();
    window.addEventListener("popstate", handleSync);
    return () => window.removeEventListener("popstate", handleSync);
  }, [location, defaultTab]);

  const setTab = useCallback(
    (tab: DashboardTab, options?: { replace?: boolean }) => {
      const targetTab = VALID_DASHBOARD_TABS.includes(tab) ? tab : defaultTab;
      const targetUrl = `/dashboard?tab=${targetTab}`;
      setLocation(targetUrl, options);
      setCurrentTab(targetTab);
    },
    [defaultTab, setLocation]
  );

  return [currentTab, setTab] as const;
}
