import { useState } from "react";
import { Link } from "wouter";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Edit,
  Trash2,
  Filter,
  Layers,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import type { Group } from "@/lib/types";

interface MyGroupsTabProps {
  groups: Group[];
  filter: "all" | "approved" | "pending" | "rejected";
  onFilterChange: (filter: "all" | "approved" | "pending" | "rejected") => void;
  onDeleteGroup: (id: string, name: string) => void;
}

export function MyGroupsTab({
  groups,
  filter,
  onFilterChange,
  onDeleteGroup,
}: MyGroupsTabProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");

  // Filtering
  let filtered = groups;
  if (filter !== "all") {
    filtered = filtered.filter((g) => g.status === filter);
  }
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.categoryName?.toLowerCase().includes(q) ||
        g.platform?.toLowerCase().includes(q) ||
        g.city?.toLowerCase().includes(q)
    );
  }

  // Sorting
  filtered = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const tA = (a.createdAt as any)?.seconds || (a.createdAt as any)?.toMillis?.() || 0;
    const tB = (b.createdAt as any)?.seconds || (b.createdAt as any)?.toMillis?.() || 0;
    return sort === "newest" ? tB - tA : tA - tB;
  });

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
            <Clock className="w-3 h-3" /> Pending Review
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

  const counts = {
    all: groups.length,
    approved: groups.filter((g) => g.status === "approved").length,
    pending: groups.filter((g) => g.status === "pending").length,
    rejected: groups.filter((g) => g.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Manage My Groups</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track approval status, update links, or remove public listings
            </p>
          </div>
        </div>

        <Link
          href="/submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Submit New Group</span>
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "all", label: "All Groups", count: counts.all },
              { id: "approved", label: "Approved", count: counts.approved },
              { id: "pending", label: "Pending", count: counts.pending },
              { id: "rejected", label: "Rejected", count: counts.rejected },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onFilterChange(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  filter === tab.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/40"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search groups..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No matching groups found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {groups.length === 0
                ? "You haven't submitted any community groups yet. Click below to submit your first link."
                : "No groups match your current filter or search criteria."}
            </p>
          </div>
          {groups.length === 0 && (
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Group</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((group) => (
            <div
              key={group.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3 relative group/card"
            >
              {/* Card Header: Logo, Name, Platform */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {group.logoUrl ? (
                      <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PlatformIcon platform={group.platform} className="w-6 h-6 text-purple-600" />
                    )}
                  </div>
                  <div>{getStatusBadge(group.status)}</div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {group.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      {group.platform}
                    </span>
                    <span>•</span>
                    <span>{group.categoryName || "General"}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {group.description || "No description provided."}
                </p>

                {/* Rejection Notice if rejected */}
                {group.status === "rejected" && group.rejectionReason && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-[11px] text-rose-900 dark:text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Rejection Feedback:</span> {group.rejectionReason}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Metadata & Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 truncate">
                  {formatDate(group.createdAt)}
                </span>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {group.status === "approved" && (
                    <Link
                      href={`/groups/${group.id}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition"
                      title="View Public Page"
                      aria-label="View Public Page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}

                  <Link
                    href={`/dashboard/edit/${group.id}`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition"
                    title="Edit Group"
                    aria-label="Edit Group"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={() => onDeleteGroup(group.id, group.name)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                    title="Delete Group"
                    aria-label="Delete Group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
