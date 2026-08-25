import { Link } from "wouter";
import { Layers, Plus, ExternalLink, Edit, Clock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import type { Group } from "@/lib/types";

interface RecentGroupsProps {
  groups: Group[];
  onViewAll: () => void;
}

export function RecentGroups({ groups, onViewAll }: RecentGroupsProps) {
  const recentList = groups.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 uppercase">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 uppercase">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 uppercase">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const d =
        timestamp.toDate?.() ||
        (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">My Recent Groups</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest submissions and current approval status
            </p>
          </div>
        </div>

        {groups.length > 0 && (
          <button
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition"
          >
            <span>View All ({groups.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      {recentList.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No groups submitted yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Share your Telegram channels, WhatsApp groups, or Discord servers with thousands of verified community seekers.
            </p>
          </div>
          <Link
            href="/submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Submit your first group</span>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {recentList.map((grp) => (
            <div
              key={grp.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-xl px-2.5 transition"
            >
              {/* Group Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                  {grp.logoUrl ? (
                    <img src={grp.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PlatformIcon platform={grp.platform} className="w-5 h-5 text-purple-600" />
                  )}
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {grp.name}
                    </h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {grp.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{grp.categoryName || "General"}</span>
                    <span>•</span>
                    <span>{formatDate(grp.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center w-full sm:w-auto">
                <div>{getStatusBadge(grp.status)}</div>

                <div className="flex items-center gap-1.5">
                  {grp.status === "approved" && (
                    <Link
                      href={`/groups/${grp.id}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition"
                      title="View Group Public Page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}

                  <Link
                    href={`/dashboard/edit/${grp.id}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition"
                    title="Edit Group"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
