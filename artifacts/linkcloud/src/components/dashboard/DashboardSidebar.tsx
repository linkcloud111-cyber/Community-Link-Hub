import { useEffect } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  Heart,
  Bell,
  MessageSquare,
  Activity,
  User,
  ShieldCheck,
  Settings,
  Link2,
  HelpCircle,
  Mail,
  AlertTriangle,
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
} from "lucide-react";
import type { DashboardTab } from "@/hooks/useDashboardTabs";

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  unreadNotifsCount: number;
  onLogout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function DashboardSidebar({
  activeTab,
  onTabChange,
  unreadNotifsCount,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  // Lock body scroll and handle ESC key when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && onCloseMobile) {
          onCloseMobile();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isMobileOpen, onCloseMobile]);

  const mainNavItems: { id: DashboardTab; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "my-groups", label: "My Groups", icon: Users },
    { id: "favorites", label: "Favorites", icon: Heart },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotifsCount },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "activity", label: "My Activity", icon: Activity },
  ];

  const accountNavItems: { id: DashboardTab; label: string; icon: any }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Account Security", icon: ShieldCheck },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "connected-accounts", label: "Connected Accounts", icon: Link2 },
  ];

  const supportNavItems: { id: DashboardTab; label: string; icon: any }[] = [
    { id: "help", label: "Help Center", icon: HelpCircle },
    { id: "messages", label: "Contact Webmaster", icon: Mail },
    { id: "complaint", label: "Report a Problem", icon: AlertTriangle },
  ];

  const isTabActive = (tabId: DashboardTab) => {
    if (tabId === "my-groups") return activeTab === "my-groups" || activeTab === "groups" || activeTab === "submitted";
    if (tabId === "messages") return activeTab === "messages" || activeTab === "contact";
    if (tabId === "activity") return activeTab === "activity" || activeTab === "my-activity";
    if (tabId === "security") return activeTab === "security" || activeTab === "change-password";
    if (tabId === "settings") return activeTab === "settings" || activeTab === "profile-settings";
    if (tabId === "profile") return activeTab === "profile" || activeTab === "my-profile";
    return activeTab === tabId;
  };

  const renderNavGroup = (title: string, items: typeof mainNavItems, isDrawer = false) => (
    <div className="space-y-1">
      {(!isCollapsed || isDrawer) && (
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
          {title}
        </p>
      )}
      {items.map((item) => {
        const active = isTabActive(item.id);
        const Icon = item.icon;
        return (
          <button
            key={item.id + item.label}
            id={`${isDrawer ? "drawer" : "dash"}-nav-${item.id}`}
            onClick={() => {
              onTabChange(item.id);
              if (onCloseMobile) onCloseMobile();
            }}
            title={isCollapsed && !isDrawer ? item.label : undefined}
            className={`w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 relative group ${
              active
                ? "bg-purple-600 text-white shadow-sm shadow-purple-200 dark:shadow-none"
                : "text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300"
            } ${isCollapsed && !isDrawer ? "justify-center px-2" : ""}`}
          >
            <Icon
              className={`w-4 h-4 flex-shrink-0 transition-transform duration-150 ${
                active
                  ? "text-white"
                  : "text-slate-400 group-hover:text-purple-600 dark:text-slate-400 dark:group-hover:text-purple-400 group-hover:scale-110"
              }`}
            />
            {(!isCollapsed || isDrawer) && <span className="truncate">{item.label}</span>}
            {(!isCollapsed || isDrawer) && item.badge && item.badge > 0 ? (
              <span
                className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  active ? "bg-white/20 text-white" : "bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
            {isCollapsed && !isDrawer && item.badge && item.badge > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-500" />
            )}
          </button>
        );
      })}
    </div>
  );

  const getSidebarBody = (isDrawer = false) => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <Link
          href="/"
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          {(!isCollapsed || isDrawer) && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 dark:text-white leading-tight truncate">
                LinkCloud
              </span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                User Dashboard
              </span>
            </div>
          )}
        </Link>

        {/* Toggle Collapse Button on Desktop (Only on >= 1024px) */}
        {!isDrawer && (
          <button
            id="toggle-sidebar-collapse"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {/* Mobile Drawer Close Button */}
        {isDrawer && onCloseMobile && (
          <button
            id="close-mobile-drawer-btn"
            onClick={onCloseMobile}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {renderNavGroup("Main", mainNavItems, isDrawer)}
        {renderNavGroup("Account", accountNavItems, isDrawer)}
        {renderNavGroup("Support", supportNavItems, isDrawer)}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
        <Link
          href="/submit"
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
          }}
          className={`w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition ${
            isCollapsed && !isDrawer ? "px-2" : ""
          }`}
          title="+ Submit Group"
        >
          <Plus className="w-4 h-4" />
          {(!isCollapsed || isDrawer) && <span>Submit Group</span>}
        </Link>

        <button
          id={`${isDrawer ? "drawer" : "sidebar"}-logout-button`}
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
            onLogout();
          }}
          className={`w-full min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition ${
            isCollapsed && !isDrawer ? "justify-center px-2" : ""
          }`}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-600" />
          {(!isCollapsed || isDrawer) && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Strictly hidden below 1024px, display:flex on lg) */}
      <aside
        id="desktop-dashboard-sidebar"
        className={`hidden lg:flex flex-col transition-all duration-200 flex-shrink-0 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="sticky top-20 h-[calc(100vh-6rem)] w-full">{getSidebarBody(false)}</div>
      </aside>

      {/* Mobile Drawer Overlay (< 1024px / lg:hidden) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation Menu">
          {/* Backdrop (z-40) */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel (z-50, anchored to right side) */}
          <div className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-right duration-200 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pl-2 pr-[calc(0.75rem+env(safe-area-inset-right,0px))]">
            {getSidebarBody(true)}
          </div>
        </div>
      )}
    </>
  );
}
