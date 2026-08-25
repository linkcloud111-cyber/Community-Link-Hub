import { Link } from "wouter";
import {
  Plus,
  Users,
  Heart,
  Bell,
  Edit3,
  ShieldCheck,
  AlertCircle,
  Lock,
  ChevronRight,
  Sparkles,
  Zap,
} from "lucide-react";
import type { DashboardTab } from "@/hooks/useDashboardTabs";
import type { Notification } from "@/lib/types";

interface QuickActionsAndAlertsProps {
  onNavigate: (tab: DashboardTab) => void;
  onEditProfile: () => void;
  unreadNotifications: Notification[];
  isEmailVerified: boolean;
  hasPhone: boolean;
}

export function QuickActionsAndAlerts({
  onNavigate,
  onEditProfile,
  unreadNotifications,
  isEmailVerified,
  hasPhone,
}: QuickActionsAndAlertsProps) {
  const actions = [
    {
      id: "submit-group",
      title: "Submit New Group",
      subtitle: "Add a Telegram, WhatsApp, or Discord link",
      icon: Plus,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-950",
      border: "hover:border-purple-300 dark:hover:border-purple-700",
      href: "/submit",
    },
    {
      id: "manage-groups",
      title: "Manage My Groups",
      subtitle: "Review status, edit details, or delete listings",
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-950",
      border: "hover:border-blue-300 dark:hover:border-blue-700",
      action: () => onNavigate("my-groups"),
    },
    {
      id: "view-favorites",
      title: "View Favorites",
      subtitle: "Quick access to your saved community links",
      icon: Heart,
      color: "text-pink-600 dark:text-pink-400",
      bg: "bg-pink-100 dark:bg-pink-950",
      border: "hover:border-pink-300 dark:hover:border-pink-700",
      action: () => onNavigate("favorites"),
    },
    {
      id: "notification-settings",
      title: "Notification Settings",
      subtitle: "Configure email alerts and system updates",
      icon: Bell,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-950",
      border: "hover:border-amber-300 dark:hover:border-amber-700",
      action: () => onNavigate("settings"),
    },
    {
      id: "edit-profile",
      title: "Edit Profile",
      subtitle: "Update personal details, city, and avatar",
      icon: Edit3,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-950",
      border: "hover:border-emerald-300 dark:hover:border-emerald-700",
      action: onEditProfile,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* QUICK ACTIONS CARD (7 COLS) */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2.5 pb-4 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Quick Actions</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Essential shortcuts for managing your community presence
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {actions.map((act) => {
            const Icon = act.icon;
            if (act.href) {
              return (
                <Link
                  key={act.id}
                  href={act.href}
                  id={`quick-act-${act.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 border border-slate-200/80 dark:border-slate-700/60 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl ${act.bg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}
                    >
                      <Icon className={`w-4 h-4 ${act.color}`} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-300 truncate">
                        {act.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {act.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition flex-shrink-0" />
                </Link>
              );
            }

            return (
              <button
                key={act.id}
                id={`quick-act-${act.id}`}
                onClick={act.action}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 border border-slate-200/80 dark:border-slate-700/60 transition group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl ${act.bg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}
                  >
                    <Icon className={`w-4 h-4 ${act.color}`} />
                  </div>
                  <div className="truncate">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-300 truncate">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {act.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* IMPORTANT ALERTS & SECURITY TIPS (5 COLS) */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 pb-4 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Important Alerts</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Security guidelines & account notices
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Dynamic Alert 1: Unverified Email */}
            {!isEmailVerified && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Email address is unverified</p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Verify your email to ensure secure account recovery and submission approvals.
                  </p>
                </div>
              </div>
            )}

            {/* Dynamic Alert 2: Unverified / Missing Phone */}
            {!hasPhone && (
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200">
                <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Add verified Indian mobile</p>
                  <p className="text-[11px] text-purple-800 dark:text-purple-300">
                    Link a mobile number for fast OTP verification and account alerts.
                  </p>
                </div>
              </div>
            )}

            {/* Static Guidelines */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Never share passwords:</strong> LinkCloud staff will never ask for your account password or OTP.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Report suspicious listings:</strong> If you spot fake or unauthorized groups, report them immediately.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Need help or assistance?</span>
          <button
            onClick={() => onNavigate("help")}
            className="font-bold text-purple-600 dark:text-purple-400 hover:underline"
          >
            Visit Help Center →
          </button>
        </div>
      </div>
    </div>
  );
}
