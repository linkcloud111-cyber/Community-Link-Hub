import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getReports, updateReport, deleteReport } from "@/lib/firestore";
import type { Report } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, ShieldAlert, CheckCircle2, Trash2, Eye } from "lucide-react";

export default function AdminReports() {
  const [location] = useLocation();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "dismissed">("pending");

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
    getReports()
      .then(setReports)
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const filtered = reports.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-destructive" /> Reports
        </h1>
        <p className="text-muted-foreground mt-1">Review and manage group reports from users.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
        {adminNav.map((nav) => (
          <Link key={nav.href} href={nav.href}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              location === nav.href ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            {nav.label}
          </Link>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["pending", "reviewed", "dismissed", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}>
            {f} ({reports.filter((r) => f === "all" || r.status === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-3xl">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">No {filter === "all" ? "" : filter} reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <div key={report.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      report.status === "pending" ? "bg-amber-500/10 text-amber-500" :
                      report.status === "reviewed" ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {report.status}
                    </span>
                    <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                      {report.reason}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      Group:{" "}
                      <Link href={`/groups/${report.groupId}`} className="text-primary hover:underline">
                        {report.groupName}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reported by: {report.reportedByName || "Anonymous"}
                    </p>
                  </div>
                  {report.details && (
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                      "{report.details}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/groups/${report.groupId}`}
                    className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    title="View group">
                    <Eye className="w-4 h-4" />
                  </Link>
                  {report.status !== "reviewed" && (
                    <button onClick={() => handleStatus(report.id, "reviewed")}
                      className="p-2 hover:bg-emerald-500/10 rounded-lg text-muted-foreground hover:text-emerald-500 transition-colors"
                      title="Mark reviewed">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {report.status !== "dismissed" && (
                    <button onClick={() => handleStatus(report.id, "dismissed")}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      title="Dismiss">
                      Dismiss
                    </button>
                  )}
                  <button onClick={() => handleDelete(report.id)}
                    className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete">
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
