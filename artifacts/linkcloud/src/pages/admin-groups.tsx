import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  getAllGroupsAdmin,
  approveGroup,
  rejectGroup,
  deleteGroup,
} from "@/lib/firestore";
import type { Group } from "@/lib/types";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  Eye,
} from "lucide-react";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function AdminGroups() {
  const [location] = useLocation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const adminNav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/groups", label: "Groups" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/categories", label: "Categories" },
    { href: "/admin/locations", label: "Locations" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/contacts", label: "Contacts" },
    { href: "/admin/settings", label: "Settings" },
  ];

  useEffect(() => {
    getAllGroupsAdmin()
      .then(setGroups)
      .catch(() => toast.error("Failed to load groups"))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approveGroup(id);
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, status: "approved" } : g)));
      toast.success("Group approved");
    } catch {
      toast.error("Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await rejectGroup(id);
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, status: "rejected" } : g)));
      toast.success("Group rejected");
    } catch {
      toast.error("Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this group?")) return;
    setActionLoading(id);
    try {
      await deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success("Group deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = groups.filter((g) => {
    if (filter !== "all" && g.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        g.name.toLowerCase().includes(s) ||
        g.platform.toLowerCase().includes(s) ||
        g.state?.toLowerCase().includes(s) ||
        g.categoryName?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const counts = {
    all: groups.length,
    pending: groups.filter((g) => g.status === "pending").length,
    approved: groups.filter((g) => g.status === "approved").length,
    rejected: groups.filter((g) => g.status === "rejected").length,
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Approved</span>;
      case "rejected":
        return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Rejected</span>;
      default:
        return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Pending</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <h1 className="text-3xl font-bold">Manage Groups</h1>

      {/* Admin Nav */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
        {adminNav.map((nav) => (
          <Link
            key={nav.href}
            href={nav.href}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              location === nav.href
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {nav.label}
          </Link>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              filter === f ? "bg-white/20" : "bg-background"
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups by name, platform, state..."
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Filter className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No groups found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Community</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Platform</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Location</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((group) => (
                  <tr key={group.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center font-bold text-sm text-muted-foreground flex-shrink-0 overflow-hidden">
                          {group.logoUrl ? (
                            <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            group.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-[180px]">{group.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{group.categoryName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 hidden sm:table-cell text-xs text-muted-foreground">
                      {group.platform}
                    </td>
                    <td className="px-3 py-4 hidden md:table-cell text-xs text-muted-foreground">
                      {[group.district, group.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-4">{statusBadge(group.status)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/groups/${group.id}`}
                          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <a
                          href={group.joinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
                          title="Visit link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {group.status !== "approved" && (
                          <button
                            onClick={() => handleApprove(group.id)}
                            disabled={actionLoading === group.id}
                            className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-muted-foreground hover:text-emerald-500 transition-colors"
                            title="Approve"
                          >
                            {actionLoading === group.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {group.status !== "rejected" && (
                          <button
                            onClick={() => handleReject(group.id)}
                            disabled={actionLoading === group.id}
                            className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(group.id)}
                          disabled={actionLoading === group.id}
                          className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {groups.length} groups
          </div>
        </div>
      )}
    </div>
  );
}
