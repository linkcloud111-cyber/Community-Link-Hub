import { Layers, CheckCircle2, Clock, XCircle, Heart, Bell, ArrowRight } from "lucide-react";
import type { DashboardTab } from "@/hooks/useDashboardTabs";

interface StatCardsProps {
  stats: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    favorites: number;
    notifications: number;
    unreadNotifs?: number;
  };
  onNavigate: (tab: DashboardTab, filter?: "all" | "approved" | "pending" | "rejected") => void;
}

export function StatCards({ stats, onNavigate }: StatCardsProps) {
  const cards = [
    {
      id: "total",
      title: "Total Groups",
      count: stats.total,
      icon: Layers,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      border: "border-purple-200 dark:border-purple-800/60",
      badge: "All Submitted",
      badgeColor: "text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50",
      action: () => onNavigate("my-groups", "all"),
    },
    {
      id: "approved",
      title: "Approved",
      count: stats.approved,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800/60",
      badge: "Live on Directory",
      badgeColor: "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50",
      action: () => onNavigate("my-groups", "approved"),
    },
    {
      id: "pending",
      title: "Pending Review",
      count: stats.pending,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800/60",
      badge: "Awaiting Webmaster",
      badgeColor: "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50",
      action: () => onNavigate("my-groups", "pending"),
    },
    {
      id: "rejected",
      title: "Rejected",
      count: stats.rejected,
      icon: XCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-200 dark:border-rose-800/60",
      badge: "Action Required",
      badgeColor: "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50",
      action: () => onNavigate("my-groups", "rejected"),
    },
    {
      id: "favorites",
      title: "Favorites",
      count: stats.favorites,
      icon: Heart,
      color: "text-pink-600 dark:text-pink-400",
      bg: "bg-pink-50 dark:bg-pink-950/40",
      border: "border-pink-200 dark:border-pink-800/60",
      badge: "Saved Groups",
      badgeColor: "text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-900/50",
      action: () => onNavigate("favorites"),
    },
    {
      id: "notifications",
      title: "Notifications",
      count: stats.notifications,
      icon: Bell,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200 dark:border-indigo-800/60",
      badge: stats.unreadNotifs && stats.unreadNotifs > 0 ? `${stats.unreadNotifs} Unread` : "Up to date",
      badgeColor:
        stats.unreadNotifs && stats.unreadNotifs > 0
          ? "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 font-bold animate-pulse"
          : "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800",
      action: () => onNavigate("notifications"),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 w-full">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            id={`stat-card-${card.id}`}
            onClick={card.action}
            className={`flex flex-col text-left p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border ${card.border} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group min-w-0 w-full`}
          >
            <div className="flex items-center justify-between w-full mb-2 sm:mb-3">
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110`}
              >
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 transition" />
            </div>

            <div className="space-y-0.5 sm:space-y-1 w-full min-w-0">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight block truncate">
                {card.count}
              </span>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                {card.title}
              </p>
            </div>

            <div className="mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-100 dark:border-slate-800/80 w-full min-w-0">
              <span
                className={`inline-block text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md ${card.badgeColor} truncate max-w-full`}
              >
                {card.badge}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
