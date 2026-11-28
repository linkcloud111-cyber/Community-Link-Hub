import { Link } from "wouter";
import {
  Menu,
  Bell,
  LayoutDashboard,
  Users,
  Heart,
  User,
  Layers,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import type { DashboardTab } from "@/hooks/useDashboardTabs";
import type { UserProfile } from "@/lib/types";

interface MobileTopNavProps {
  onOpenDrawer: () => void;
  unreadCount: number;
  profile: UserProfile | null;
  onNavigateNotifications: () => void;
  onNavigateProfile: () => void;
}

export function MobileTopNav({
  onOpenDrawer,
  unreadCount,
  profile,
  onNavigateNotifications,
  onNavigateProfile,
}: MobileTopNavProps) {
  const { resolvedTheme } = useTheme();
  const { settings } = useSiteSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const configuredTheme = settings?.websiteTheme || (settings as any)?.theme || "dark";
  const effectiveTheme = configuredTheme === "system" ? (resolvedTheme || "dark") : configuredTheme;
  const brandTitle = settings?.headerTitle || settings?.siteName || "LinkCloud";

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "LC";
  };

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm mb-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
      {/* Left: Drawer Toggle & Brand */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          id="mobile-header-drawer-toggle"
          onClick={onOpenDrawer}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-slate-900 dark:text-white tracking-tight leading-none truncate">
              {brandTitle}
            </span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold leading-tight">
              Dashboard
            </span>
          </div>
        </Link>
      </div>

      {/* Right: Theme Indicator, Notifications, Avatar */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => {
            if (configuredTheme === "system") {
              toast.info(`Theme is set by Webmaster to follow your device System Preference (${effectiveTheme.toUpperCase()} mode is active).`);
            } else {
              toast.info(`Theme is centrally enforced by Webmaster: ${effectiveTheme.toUpperCase()} mode is active.`);
            }
          }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label={configuredTheme === "system" ? `Theme: System Preference (${effectiveTheme} mode active)` : `Theme: ${effectiveTheme} (Enforced by Webmaster)`}
          title={configuredTheme === "system" ? `Theme: Following System Preference (${effectiveTheme} mode active)` : `Theme: ${effectiveTheme} (Enforced by Webmaster)`}
        >
          {mounted && effectiveTheme === "dark" ? (
            <Moon className="w-4 h-4 text-purple-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
        </button>

        <button
          id="mobile-header-notifs-btn"
          onClick={onNavigateNotifications}
          className="min-w-[44px] min-h-[44px] relative flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-purple-600 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
          )}
        </button>

        <button
          id="mobile-header-avatar-btn"
          onClick={onNavigateProfile}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Open Profile"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 overflow-hidden flex items-center justify-center font-bold text-xs text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(profile?.displayName || "User")
            )}
          </div>
        </button>
      </div>
    </header>
  );
}

interface MobileBottomNavProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onOpenMenu?: () => void;
  unreadCount?: number;
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenMenu,
  unreadCount = 0,
}: MobileBottomNavProps) {
  const { settings } = useSiteSettings();
  const favoritesEnabled = settings?.favoritesEnabled !== false;
  const isOverview = activeTab === "overview";
  const isMyGroups = activeTab === "my-groups" || activeTab === "groups" || activeTab === "submitted";
  const isFavorites = favoritesEnabled && activeTab === "favorites";
  const isMore = !isOverview && !isMyGroups && !isFavorites;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800 px-3 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg"
    >
      {/* 1. Home */}
      <button
        id="mobile-nav-overview"
        onClick={() => onTabChange("overview")}
        className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all relative ${
          isOverview
            ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60"
            : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 active:scale-95"
        }`}
      >
        <LayoutDashboard className={`w-5 h-5 ${isOverview ? "stroke-[2.5] text-purple-600 dark:text-purple-400" : "stroke-2"}`} />
        <span className="leading-none">Home</span>
        {isOverview && (
          <span className="w-1 h-1 rounded-full bg-purple-600 dark:bg-purple-400" />
        )}
      </button>

      {/* 2. My Groups */}
      <button
        id="mobile-nav-my-groups"
        onClick={() => onTabChange("my-groups")}
        className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all relative ${
          isMyGroups
            ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60"
            : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 active:scale-95"
        }`}
      >
        <Users className={`w-5 h-5 ${isMyGroups ? "stroke-[2.5] text-purple-600 dark:text-purple-400" : "stroke-2"}`} />
        <span className="leading-none">My Groups</span>
        {isMyGroups && (
          <span className="w-1 h-1 rounded-full bg-purple-600 dark:bg-purple-400" />
        )}
      </button>

      {/* 3. Favorites */}
      {favoritesEnabled && (
        <button
          id="mobile-nav-favorites"
          onClick={() => onTabChange("favorites")}
          className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all relative ${
            isFavorites
              ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60"
              : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 active:scale-95"
          }`}
        >
          <Heart className={`w-5 h-5 ${isFavorites ? "stroke-[2.5] text-purple-600 dark:text-purple-400" : "stroke-2"}`} />
          <span className="leading-none">Favorites</span>
          {isFavorites && (
            <span className="w-1 h-1 rounded-full bg-purple-600 dark:bg-purple-400" />
          )}
        </button>
      )}

      {/* 4. More */}
      <button
        id="mobile-nav-more"
        onClick={() => onTabChange("more")}
        className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all relative ${
          isMore
            ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60"
            : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 active:scale-95"
        }`}
      >
        <div className="relative">
          <Menu className={`w-5 h-5 ${isMore ? "stroke-[2.5] text-purple-600 dark:text-purple-400" : "stroke-2"}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-purple-600 ring-2 ring-white dark:ring-slate-900" />
          )}
        </div>
        <span className="leading-none">More</span>
        {isMore && (
          <span className="w-1 h-1 rounded-full bg-purple-600 dark:bg-purple-400" />
        )}
      </button>
    </nav>
  );
}
