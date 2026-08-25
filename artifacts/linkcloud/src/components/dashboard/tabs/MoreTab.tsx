import { Link } from "wouter";
import {
  User,
  Bell,
  ShieldCheck,
  KeyRound,
  Settings,
  HelpCircle,
  Mail,
  AlertTriangle,
  FileText,
  Shield,
  Copyright,
  Info,
  LogOut,
  ChevronRight,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { DashboardTab } from "@/hooks/useDashboardTabs";
import type { UserProfile } from "@/lib/types";

interface MoreTabProps {
  profile: UserProfile | null;
  email: string | null;
  isEmailVerified?: boolean;
  unreadNotifsCount: number;
  onNavigate: (tab: DashboardTab) => void;
  onEditProfile: () => void;
  onLogout: () => void;
}

export function MoreTab({
  profile,
  email,
  isEmailVerified: propIsEmailVerified,
  unreadNotifsCount,
  onNavigate,
  onEditProfile,
  onLogout,
}: MoreTabProps) {
  const displayName = profile?.displayName || "User";
  const userEmail = profile?.email || email || "No email";
  const accountUid = profile?.accountUid || "linkcloud----";
  const isEmailVerified = propIsEmailVerified !== undefined ? propIsEmailVerified : Boolean(profile?.emailVerified);

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "LC";
  };

  const accountSections = [
    {
      id: "profile",
      label: "My Profile",
      description: "View and edit personal info, avatar, and bio",
      icon: User,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/50",
      action: () => onNavigate("profile"),
    },
    {
      id: "notifications",
      label: "Notifications & Alerts",
      description: "System updates, group approvals, and security alerts",
      icon: Bell,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/50",
      badge: unreadNotifsCount > 0 ? `${unreadNotifsCount} new` : undefined,
      action: () => onNavigate("notifications"),
    },
    {
      id: "security",
      label: "Account Security & Credentials",
      description: "Manage password, mobile OTP, and account lifecycle",
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/50",
      action: () => onNavigate("security"),
    },
    {
      id: "change-password",
      label: "Change Password",
      description: "Update authentication password securely",
      icon: KeyRound,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
      action: () => onNavigate("security"),
    },
    {
      id: "settings",
      label: "Settings & Preferences",
      description: "Notification delivery, email alerts, and privacy rules",
      icon: Settings,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800",
      action: () => onNavigate("settings"),
    },
  ];

  const supportSections = [
    {
      id: "help",
      label: "Help Center & FAQ",
      description: "Answers to common submission and policy questions",
      icon: HelpCircle,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
      action: () => onNavigate("help"),
    },
    {
      id: "contact",
      label: "Contact Webmaster",
      description: "Direct inquiries and admin support desk",
      icon: Mail,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-50 dark:bg-cyan-950/50",
      action: () => onNavigate("messages"),
    },
    {
      id: "complaint",
      label: "Submit a Grievance / Report",
      description: "Report copyright, fraud, or inappropriate groups",
      icon: AlertTriangle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
      action: () => onNavigate("complaint"),
    },
  ];

  const legalLinks = [
    {
      id: "privacy",
      label: "Privacy Policy",
      href: "/privacy",
      icon: Shield,
    },
    {
      id: "terms",
      label: "Terms of Service",
      href: "/terms",
      icon: FileText,
    },
    {
      id: "dmca",
      label: "DMCA & Copyright Policy",
      href: "/dmca",
      icon: Copyright,
    },
    {
      id: "about",
      label: "About LinkCloud",
      href: "/about",
      icon: Info,
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-6">
      {/* User Mini-Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 overflow-hidden flex items-center justify-center font-bold text-lg text-purple-700 dark:text-purple-300 shadow-sm flex-shrink-0">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {displayName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userEmail}</p>
            <div className="flex items-center gap-2 pt-0.5 text-[11px]">
              <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold truncate">
                UID: {accountUid}
              </span>
              <span>•</span>
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <AlertCircle className="w-3 h-3" /> Unverified
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onEditProfile}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 transition border border-purple-200 dark:border-purple-800 flex-shrink-0"
        >
          Edit
        </button>
      </div>

      {/* Account Navigation Group */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Account & Security
        </p>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {accountSections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`more-nav-${item.id}`}
                onClick={item.action}
                className="w-full min-h-[52px] flex items-center justify-between py-3 px-2 rounded-xl hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}
                  >
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-300 truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Support & Grievances */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Help & Grievances
        </p>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {supportSections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`more-nav-${item.id}`}
                onClick={item.action}
                className="w-full min-h-[52px] flex items-center justify-between py-3 px-2 rounded-xl hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}
                  >
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-300 truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Legal & Platform Policies */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Legal & Policies
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {legalLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                id={`more-legal-${item.id}`}
                className="min-h-[44px] flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-slate-200/80 dark:border-slate-700/60 transition group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-300 truncate">
                    {item.label}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2">
        <button
          id="more-tab-logout-btn"
          onClick={onLogout}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold text-sm transition shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of LinkCloud</span>
        </button>
      </div>
    </div>
  );
}
