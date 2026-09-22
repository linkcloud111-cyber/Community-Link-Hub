import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  getReports,
  updateReport,
  deleteReport,
  getAllGroupsAdmin,
  updateGroupInviteLink,
  toggleGroupHide,
} from "@/lib/firestore";
import type { Report, Group } from "@/lib/types";
import AdminNav from "@/components/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Eye,
  Link as LinkIcon,
  AlertCircle,
  ExternalLink,
  EyeOff,
  RefreshCw,
  Search,
  Download,
} from "lucide-react";

export default function AdminReports() {
  const [tab, setTab] = useState<"reports" | "linkHealth">("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "reviewed" | "dismissed">("pending");
  const [linkSearch, setLinkSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [repData, grpData] = await Promise.all([getReports(), getAllGroupsAdmin()]);
      setReports(repData);
      setGroups(grpData);
    } catch {
      toast.error("Failed to load reports and link health data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatus = async (id: string, status: Report["status"]) => {
    try {
      await updateReport(id, status);
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success(`Report marked as ${status}`);
    } catch {
      toast.error("Failed to update report");
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteReport = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report deleted");
      setDeleteConfirmId(null);
    } catch {
      toast.error("Failed to delete report");
    }
  };

  const handleToggleLinkHealth = async (group: Group) => {
    const nextStatus = group.linkStatus === "inactive" ? "active" : "inactive";
    setUpdatingId(group.id);
    try {
      await updateGroupInviteLink(group.id, group.joinUrl, nextStatus);
      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, linkStatus: nextStatus } : g)));
      toast.success(`Invite link set to ${nextStatus}`);
    } catch {
      toast.error("Failed to update invite link health");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleHideGroup = async (group: Group) => {
    setUpdatingId(group.id);
    try {
      await toggleGroupHide(group.id, !group.hidden);
      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, hidden: !group.hidden } : g)));
      toast.success(group.hidden ? "Group unhidden" : "Group hidden");
    } catch {
      toast.error("Failed to update group visibility");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportReportsCSV = () => {
    if (reports.length === 0) {
      toast.info("No report records to export.");
      return;
    }

    const headers = ["Report ID", "Group ID", "Group Title", "Reason", "Reporter Email", "Status", "Created At"];
    const rows = reports.map((r) => [
      `"${r.id}"`,
      `"${r.groupId}"`,
      `"${((r as any).groupTitle || (r as any).groupName || '').replace(/"/g, '""')}"`,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      `"${(r as any).reporterEmail || (r as any).userEmail || ''}"`,
      `"${r.status}"`,
      `"${r.createdAt ? new Date((r.createdAt as any)?.toDate ? (r.createdAt as any).toDate() : (r.createdAt as any)?.seconds ? (r.createdAt as any).seconds * 1000 : (r.createdAt as any)).toISOString() : ''}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LinkCloud_Reports_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${reports.length} report records to CSV.`);
  };

  const filteredReports = reports.filter((r) => reportFilter === "all" || r.status === reportFilter);
  const pendingReports = reports.filter((r) => r.status === "pending");

  const brokenGroups = groups.filter((g) => {
    if (g.linkStatus !== "inactive") return false;
    if (linkSearch) {
      return g.name.toLowerCase().includes(linkSearch.toLowerCase()) || g.platform.toLowerCase().includes(linkSearch.toLowerCase());
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-destructive" /> Reports & Link Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audit user abuse reports and maintain active community invite link health across all platforms.
          </p>
        </div>

        <button
          onClick={handleExportReportsCSV}
          className="px-4 py-2.5 bg-card border border-border hover:bg-muted text-foreground font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-primary" />
          <span>Export Reports CSV</span>
        </button>
      </div>

      {/* Admin Nav */}
      <AdminNav stats={{ pendingReports: pendingReports.length }} />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setTab("reports")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === "reports" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Abuse Reports ({pendingReports.length} pending)
        </button>

        <button
          onClick={() => setTab("linkHealth")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            tab === "linkHealth" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" /> Broken Link Detector ({groups.filter((g) => g.linkStatus === "inactive").length})
        </button>
      </div>

      {tab === "reports" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["pending", "reviewed", "dismissed", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setReportFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                  reportFilter === f ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f} ({reports.filter((r) => f === "all" || r.status === f).length})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-3xl">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground text-xs font-bold">No {reportFilter === "all" ? "" : reportFilter} reports found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <div key={report.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            report.status === "pending"
                              ? "bg-amber-500/10 text-amber-500"
                              : report.status === "reviewed"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {report.status}
                        </span>
                        <span className="text-[10px] font-extrabold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                          {report.reason}
                        </span>
                      </div>

                      <div>
                        <p className="font-bold text-sm">
                          Group:{" "}
                          <Link href={`/groups/${report.groupId}`} className="text-primary hover:underline">
                            {report.groupName}
                          </Link>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reported by: {report.reportedByName || "Anonymous User"}
                        </p>
                      </div>

                      {report.details && (
                        <p className="text-xs text-foreground bg-muted/40 rounded-xl p-3 font-mono">
                          "{report.details}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/groups/${report.groupId}`}
                        className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground"
                        title="View Group Page"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>

                      {report.status !== "reviewed" && (
                        <button
                          onClick={() => handleStatus(report.id, "reviewed")}
                          className="p-2 hover:bg-emerald-500/10 rounded-xl text-muted-foreground hover:text-emerald-500"
                          title="Mark Reviewed"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}

                      {report.status !== "dismissed" && (
                        <button
                          onClick={() => handleStatus(report.id, "dismissed")}
                          className="px-3 py-1.5 text-xs border border-border rounded-xl hover:bg-muted font-bold text-muted-foreground"
                        >
                          Dismiss
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(report.id)}
                        className="p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive"
                        title="Delete Report"
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
      )}

      {tab === "linkHealth" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder="Search broken links by group name..."
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {brokenGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="font-bold text-sm">All community invite links are healthy!</p>
                </div>
              ) : (
                brokenGroups.map((g) => (
                  <div key={g.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/20">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{g.name}</p>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          Inactive Link
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{g.platform} • {g.joinUrl}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={g.joinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-muted rounded-xl text-xs font-bold flex items-center gap-1 hover:text-primary"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Test Link
                      </a>

                      <button
                        onClick={() => handleToggleLinkHealth(g)}
                        disabled={updatingId === g.id}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-500/20"
                      >
                        Mark Active
                      </button>

                      <button
                        onClick={() => handleToggleHideGroup(g)}
                        disabled={updatingId === g.id}
                        className="px-3 py-1.5 bg-slate-500/10 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-500/20"
                      >
                        {g.hidden ? "Unhide" : "Hide Group"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Delete Report Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Report"
        description="Are you sure you want to delete this report record? This action cannot be undone."
        confirmText="Delete Report"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteReport}
      />
    </div>
  );
}
