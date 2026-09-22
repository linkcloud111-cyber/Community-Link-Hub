import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  getAllGroupsAdmin,
  approveGroup,
  rejectGroup,
  requestGroupChanges,
  deleteGroup,
  toggleGroupHide,
  toggleGroupPin,
  toggleGroupFeature,
  updateGroupInviteLink,
  updateGroup,
  bulkApproveGroups,
  bulkRejectGroups,
  bulkDeleteGroups,
  bulkHideGroups,
  bulkFeatureGroups,
  getUserProfile,
  getUserGroups,
} from "@/lib/firestore";
import type { Group, GroupStatus, UserProfile } from "@/lib/types";
import AdminNav from "@/components/admin-nav";
import { PlatformIcon } from "@/components/platform-icon";
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  Star,
  Pin,
  EyeOff,
  Edit3,
  MessageSquare,
  CheckSquare,
  Square,
  ShieldCheck,
  Link as LinkIcon,
  X,
  AlertCircle,
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  MapPin,
  BadgeCheck,
  Download,
} from "lucide-react";

type FilterTab = "all" | "pending" | "approved" | "rejected" | "featured" | "hidden" | "inactive";

export default function AdminGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<FilterTab>("pending");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Bulk confirmation modal state
  type BulkActionType = "approve" | "reject" | "delete" | "hide" | "unhide" | "feature" | "unfeature" | null;
  const [bulkModalAction, setBulkModalAction] = useState<BulkActionType>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // Modals state
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [viewGroup, setViewGroup] = useState<Group | null>(null);
  const [changesGroup, setChangesGroup] = useState<Group | null>(null);
  const [changesMsg, setChangesMsg] = useState("");

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Submitter inspector modal state
  const [inspectSubmitterUid, setInspectSubmitterUid] = useState<string | null>(null);
  const [submitterProfile, setSubmitterProfile] = useState<UserProfile | null>(null);
  const [submitterHistory, setSubmitterHistory] = useState<Group[]>([]);
  const [submitterLoading, setSubmitterLoading] = useState(false);

  const handleInspectSubmitter = async (uid: string) => {
    if (!uid) return;
    setInspectSubmitterUid(uid);
    setSubmitterLoading(true);
    try {
      const [prof, history] = await Promise.all([
        getUserProfile(uid),
        getUserGroups(uid),
      ]);
      setSubmitterProfile(prof);
      setSubmitterHistory(history);
    } catch {
      toast.error("Failed to load submitter details");
    } finally {
      setSubmitterLoading(false);
    }
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await getAllGroupsAdmin();
      setGroups(data);
    } catch {
      toast.error("Failed to load groups for webmaster dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((g) => g.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.info("No group records to export.");
      return;
    }

    const headers = [
      "Group ID",
      "Title",
      "Platform",
      "Category",
      "State",
      "District",
      "City",
      "Status",
      "Featured",
      "Hidden",
      "Submitter Name",
      "Submitter Email",
      "Join URL",
      "Created At",
    ];

    const rows = filtered.map((g) => [
      `"${g.id}"`,
      `"${(g.name || "").replace(/"/g, '""')}"`,
      `"${g.platform}"`,
      `"${g.categoryName || g.categoryId || ""}"`,
      `"${g.state || ""}"`,
      `"${g.district || ""}"`,
      `"${g.city || ""}"`,
      `"${g.status}"`,
      `"${g.featured ? "Yes" : "No"}"`,
      `"${g.hidden ? "Yes" : "No"}"`,
      `"${((g as any).submittedByName || (g as any).submitterName || "").replace(/"/g, '""')}"`,
      `"${(g as any).submittedByEmail || (g as any).submitterEmail || ""}"`,
      `"${g.joinUrl}"`,
      `"${g.createdAt ? new Date((g.createdAt as any)?.toDate ? (g.createdAt as any).toDate() : (g.createdAt as any)?.seconds ? (g.createdAt as any).seconds * 1000 : (g.createdAt as any)).toISOString() : ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LinkCloud_Groups_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${filtered.length} group records to CSV.`);
  };

  // Action handlers
  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approveGroup(id);
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, status: "approved" } : g)));
      toast.success("Group approved successfully");
    } catch {
      toast.error("Failed to approve group");
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
      toast.error("Failed to reject group");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async () => {
    if (!changesGroup || !changesMsg.trim()) {
      toast.error("Please enter a message explaining requested changes");
      return;
    }
    setActionLoading(changesGroup.id);
    try {
      await requestGroupChanges(changesGroup.id, changesMsg);
      toast.success("Change request sent to community owner");
      setChangesGroup(null);
      setChangesMsg("");
      await loadGroups();
    } catch {
      toast.error("Failed to submit change request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setActionLoading(id);
    try {
      await deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      toast.success("Group deleted permanently");
      setDeleteConfirmId(null);
    } catch {
      toast.error("Failed to delete group");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleHide = async (id: string, currentHidden?: boolean) => {
    setActionLoading(id);
    try {
      await toggleGroupHide(id, !currentHidden);
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, hidden: !currentHidden } : g)));
      toast.success(currentHidden ? "Group unhidden" : "Group hidden from directory");
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePin = async (id: string, currentPinned?: boolean) => {
    setActionLoading(id);
    try {
      await toggleGroupPin(id, !currentPinned);
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, pinned: !currentPinned } : g)));
      toast.success(currentPinned ? "Group unpinned" : "Group pinned to top");
    } catch {
      toast.error("Failed to update pin status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFeature = async (id: string, currentFeatured?: boolean) => {
    setActionLoading(id);
    try {
      await toggleGroupFeature(id, !currentFeatured);
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, featured: !currentFeatured } : g)));
      toast.success(currentFeatured ? "Removed from featured" : "Added to featured");
    } catch {
      toast.error("Failed to update featured status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleLinkStatus = async (id: string, currentStatus?: string) => {
    const nextStatus = currentStatus === "inactive" ? "active" : "inactive";
    setActionLoading(id);
    try {
      const g = groups.find((item) => item.id === id);
      if (g) {
        await updateGroupInviteLink(id, g.joinUrl, nextStatus);
        setGroups((prev) => prev.map((item) => (item.id === id ? { ...item, linkStatus: nextStatus } : item)));
        toast.success(`Link status set to ${nextStatus}`);
      }
    } catch {
      toast.error("Failed to update link status");
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk operations
  const openBulkModal = (action: BulkActionType) => {
    if (!selectedIds.length) {
      toast.error("No groups selected");
      return;
    }
    setBulkModalAction(action);
  };

  const executeBulkAction = async () => {
    if (!bulkModalAction || !selectedIds.length) return;
    setIsProcessingBulk(true);
    const count = selectedIds.length;
    try {
      if (bulkModalAction === "approve") {
        await bulkApproveGroups(selectedIds);
        toast.success(`Successfully approved ${count} group${count > 1 ? "s" : ""}`);
      } else if (bulkModalAction === "reject") {
        await bulkRejectGroups(selectedIds);
        toast.success(`Successfully rejected ${count} group${count > 1 ? "s" : ""}`);
      } else if (bulkModalAction === "delete") {
        await bulkDeleteGroups(selectedIds);
        toast.success(`Permanently deleted ${count} group${count > 1 ? "s" : ""}`);
      } else if (bulkModalAction === "hide") {
        await bulkHideGroups(selectedIds, true);
        toast.success(`Hidden ${count} group${count > 1 ? "s" : ""} from directory`);
      } else if (bulkModalAction === "unhide") {
        await bulkHideGroups(selectedIds, false);
        toast.success(`Unhidden ${count} group${count > 1 ? "s" : ""}`);
      } else if (bulkModalAction === "feature") {
        await bulkFeatureGroups(selectedIds, true);
        toast.success(`Marked ${count} group${count > 1 ? "s" : ""} as featured`);
      } else if (bulkModalAction === "unfeature") {
        await bulkFeatureGroups(selectedIds, false);
        toast.success(`Removed ${count} group${count > 1 ? "s" : ""} from featured`);
      }
      setSelectedIds([]);
      setBulkModalAction(null);
      await loadGroups();
    } catch {
      toast.error(`Failed to perform bulk ${bulkModalAction}`);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Save edit form
  const handleSaveGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroup) return;
    setActionLoading(editGroup.id);
    try {
      await updateGroup(editGroup.id, {
        name: editGroup.name,
        platform: editGroup.platform,
        categoryId: editGroup.categoryId,
        categoryName: editGroup.categoryName,
        joinUrl: editGroup.joinUrl,
        logoUrl: editGroup.logoUrl,
        description: editGroup.description,
        rules: editGroup.rules,
        status: editGroup.status,
        linkStatus: editGroup.linkStatus,
        state: editGroup.state,
        district: editGroup.district,
        city: editGroup.city,
      });
      toast.success("Group updated successfully");
      setEditGroup(null);
      await loadGroups();
    } catch {
      toast.error("Failed to update group");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter calculation
  const filtered = groups.filter((g) => {
    if (filter === "pending" && g.status !== "pending") return false;
    if (filter === "approved" && g.status !== "approved") return false;
    if (filter === "rejected" && g.status !== "rejected") return false;
    if (filter === "featured" && !g.featured) return false;
    if (filter === "hidden" && !g.hidden) return false;
    if (filter === "inactive" && g.linkStatus !== "inactive") return false;

    if (search) {
      const s = search.toLowerCase().trim();
      if (s) {
        const tokens = s.split(/\s+/).filter(Boolean);
        const nameText = (g.name || "").toLowerCase();
        const descText = (g.description || "").toLowerCase();
        const catText = (g.categoryName || "").toLowerCase();
        const platText = (g.platform || "").toLowerCase();
        const langText = (g.language || "").toLowerCase();
        const stateText = (g.state || "").toLowerCase();
        const distText = (g.district || "").toLowerCase();
        const cityText = (g.city || "").toLowerCase();
        const minAgeStr = g.minimumAge !== undefined && g.minimumAge !== null ? String(g.minimumAge).toLowerCase() : "";
        const submitterNameText = (g.submittedByName || "").toLowerCase();
        const submitterEmailText = (g.submittedByEmail || "").toLowerCase();
        const docIdText = (g.id || "").toLowerCase();
        const joinUrlText = (g.joinUrl || "").toLowerCase();
        const statusText = (g.status || "").toLowerCase();
        const featuredText = g.featured ? "featured" : "";
        const hiddenText = g.hidden ? "hidden" : "";
        const tagsArr = Array.isArray(g.tags) ? g.tags.map((t) => (t || "").toLowerCase()) : [];
        const tagsCombined = tagsArr.join(" ");

        const fields = [
          nameText,
          descText,
          catText,
          platText,
          langText,
          stateText,
          distText,
          cityText,
          minAgeStr,
          submitterNameText,
          submitterEmailText,
          docIdText,
          joinUrlText,
          statusText,
          featuredText,
          hiddenText,
          tagsCombined,
          ...tagsArr,
        ];

        return tokens.some((token) => fields.some((f) => f.includes(token)));
      }
    }
    return true;
  });

  const counts = {
    all: groups.length,
    pending: groups.filter((g) => g.status === "pending").length,
    approved: groups.filter((g) => g.status === "approved").length,
    rejected: groups.filter((g) => g.status === "rejected").length,
    featured: groups.filter((g) => g.featured).length,
    hidden: groups.filter((g) => g.hidden).length,
    inactive: groups.filter((g) => g.linkStatus === "inactive").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" /> Group Management Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete Webmaster authority: approve, reject, edit, feature, pin, hide, or bulk manage.
          </p>
        </div>
      </div>

      {/* Admin Navigation */}
      <AdminNav stats={{ pendingGroups: counts.pending }} />

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {(["all", "pending", "approved", "rejected", "featured", "hidden", "inactive"] as FilterTab[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setSelectedIds([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  filter === f ? "bg-white/20 text-white" : "bg-background text-foreground"
                }`}
              >
                {counts[f]}
              </span>
            </button>
          )
        )}
      </div>

      {/* Search Bar & Bulk Actions Bar & CSV Export */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups by name, submitter, platform..."
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-card border border-border hover:bg-muted text-foreground font-bold rounded-xl text-xs flex items-center gap-2 transition-colors whitespace-nowrap shadow-sm"
            title="Export filtered groups to CSV"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-primary/10 border border-primary/20 p-2 rounded-2xl w-full md:w-auto">
            <span className="text-xs font-bold text-primary px-2.5 py-1 bg-primary/10 rounded-xl">
              {selectedIds.length} group{selectedIds.length > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={() => openBulkModal("approve")}
              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => openBulkModal("reject")}
              className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={() => openBulkModal("hide")}
              className="px-2.5 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" /> Hide
            </button>
            <button
              onClick={() => openBulkModal("feature")}
              className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors flex items-center gap-1.5"
            >
              <Star className="w-3.5 h-3.5" /> Feature
            </button>
            <button
              onClick={() => openBulkModal("delete")}
              className="px-2.5 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-bold hover:bg-destructive/90 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors ml-auto md:ml-0"
              title="Deselect all"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table Display */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl text-muted-foreground">
          <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold text-base">No groups match your current filter</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <button onClick={toggleSelectAll} className="p-1 text-muted-foreground hover:text-foreground">
                      {selectedIds.length === filtered.length ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-bold text-left uppercase text-muted-foreground tracking-wider">Group</th>
                  <th className="px-3 py-3 font-bold text-left uppercase text-muted-foreground tracking-wider hidden sm:table-cell">Platform</th>
                  <th className="px-3 py-3 font-bold text-left uppercase text-muted-foreground tracking-wider hidden md:table-cell">Submitter</th>
                  <th className="px-3 py-3 font-bold text-left uppercase text-muted-foreground tracking-wider">Status</th>
                  <th className="px-3 py-3 font-bold text-left uppercase text-muted-foreground tracking-wider hidden lg:table-cell">Flags</th>
                  <th className="px-4 py-3 font-bold text-right uppercase text-muted-foreground tracking-wider">Webmaster Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((group) => {
                  const isSelected = selectedIds.includes(group.id);
                  return (
                    <tr
                      key={group.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(group.id)} className="p-1">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center font-extrabold text-xs overflow-hidden flex-shrink-0">
                            {group.logoUrl ? (
                              <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              group.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate max-w-[200px]">{group.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                              <CategoryIcon name={group.categoryName} className="w-3 h-3 text-primary shrink-0" />
                              <span className="truncate">{group.categoryName}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                        <span className="flex items-center gap-1.5">
                          <PlatformIcon platform={group.platform} className="w-4 h-4 shrink-0" />
                          <span>{group.platform}</span>
                        </span>
                      </td>

                      <td className="px-3 py-3 hidden md:table-cell">
                        <button
                          onClick={() => handleInspectSubmitter(group.submittedBy)}
                          className="text-left hover:bg-muted/60 p-1.5 rounded-xl transition-colors group/sub"
                          title="Click to view submitter profile & submission history"
                        >
                          <p className="font-semibold text-foreground group-hover/sub:text-primary transition-colors truncate max-w-[140px]">
                            {group.submittedByName || "User"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            {group.submittedByEmail || group.submittedBy}
                          </p>
                        </button>
                      </td>

                      <td className="px-3 py-3 font-bold">
                        <StatusBadge status={group.status} changesRequested={group.changesRequested} />
                      </td>

                      <td className="px-3 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          {group.featured && (
                            <span className="p-1 bg-amber-500/10 text-amber-500 rounded-md" title="Featured">
                              <Star className="w-3.5 h-3.5 fill-amber-500" />
                            </span>
                          )}
                          {group.pinned && (
                            <span className="p-1 bg-blue-500/10 text-blue-500 rounded-md" title="Pinned">
                              <Pin className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {group.hidden && (
                            <span className="p-1 bg-slate-500/10 text-slate-500 rounded-md" title="Hidden">
                              <EyeOff className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {group.linkStatus === "inactive" && (
                            <span className="p-1 bg-destructive/10 text-destructive rounded-md" title="Broken Link">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewGroup(group)}
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
                            title="Quick View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setEditGroup(group)}
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary"
                            title="Edit Group"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {group.status !== "approved" && (
                            <button
                              onClick={() => handleApprove(group.id)}
                              disabled={actionLoading === group.id}
                              className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-muted-foreground hover:text-emerald-500"
                              title="Approve"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {group.status !== "rejected" && (
                            <button
                              onClick={() => handleReject(group.id)}
                              disabled={actionLoading === group.id}
                              className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setChangesGroup(group);
                              setChangesMsg(group.changesRequestedMessage || "");
                            }}
                            className="p-1.5 hover:bg-blue-500/10 rounded-lg text-muted-foreground hover:text-blue-500"
                            title="Request Changes"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleFeature(group.id, group.featured)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              group.featured
                                ? "bg-amber-500/10 text-amber-500"
                                : "hover:bg-muted text-muted-foreground hover:text-amber-500"
                            }`}
                            title="Toggle Featured"
                          >
                            <Star className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleHide(group.id, group.hidden)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              group.hidden
                                ? "bg-slate-500/10 text-slate-500"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                            title="Toggle Visibility (Hide/Unhide)"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(group.id)}
                            disabled={actionLoading === group.id}
                            className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive"
                            title="Permanently Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: View Group Details */}
      {viewGroup && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold">Group Overview</h2>
              <button onClick={() => setViewGroup(null)} className="p-1.5 hover:bg-muted rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <img src={viewGroup.logoUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100"} alt="" className="w-12 h-12 rounded-xl object-cover" />
                <div>
                  <h3 className="text-base font-bold">{viewGroup.name}</h3>
                  <p className="text-muted-foreground">{viewGroup.platform} • {viewGroup.categoryName}</p>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <p><strong>Submitter:</strong> {viewGroup.submittedByName} ({viewGroup.submittedByEmail || "No Email"})</p>
                  <button
                    onClick={() => handleInspectSubmitter(viewGroup.submittedBy)}
                    className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                  >
                    <User className="w-3 h-3" /> Inspect Submitter
                  </button>
                </div>
                <p><strong>Submitter UID:</strong> <span className="font-mono text-[10px] text-muted-foreground">{viewGroup.submittedBy}</span></p>
                <p><strong>Join URL:</strong> <a href={viewGroup.joinUrl} target="_blank" rel="noreferrer" className="text-primary underline">{viewGroup.joinUrl}</a></p>
                <p><strong>Location:</strong> {[viewGroup.city, viewGroup.district, viewGroup.state].filter(Boolean).join(", ") || "All India"}</p>
                <p><strong>Language:</strong> {viewGroup.language || "Hindi"}</p>
              </div>

              <div>
                <p className="font-bold mb-1">Description:</p>
                <p className="p-3 bg-muted/20 rounded-xl whitespace-pre-wrap">{viewGroup.description || "No description."}</p>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button onClick={() => setViewGroup(null)} className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Request Changes */}
      {changesGroup && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" /> Request Changes from Owner
              </h2>
              <button onClick={() => setChangesGroup(null)} className="p-1.5 hover:bg-muted rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Provide feedback to <strong>{changesGroup.name}</strong> owner. They will see this message in their dashboard and can update their group.
            </p>

            <textarea
              value={changesMsg}
              onChange={(e) => setChangesMsg(e.target.value)}
              placeholder="e.g. Please upload a high-quality community logo and provide valid rules..."
              className="w-full h-28 p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setChangesGroup(null)} className="px-4 py-2 bg-muted rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleRequestChanges} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold">
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Group */}
      {editGroup && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveGroupEdit} className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" /> Edit Community Details
              </h2>
              <button type="button" onClick={() => setEditGroup(null)} className="p-1.5 hover:bg-muted rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Group Name</label>
                <input
                  value={editGroup.name}
                  onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Platform</label>
                <input
                  value={editGroup.platform}
                  onChange={(e) => setEditGroup({ ...editGroup, platform: e.target.value as any })}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Category Name</label>
                <input
                  value={editGroup.categoryName}
                  onChange={(e) => setEditGroup({ ...editGroup, categoryName: e.target.value })}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Invite Link</label>
                <input
                  value={editGroup.joinUrl}
                  onChange={(e) => setEditGroup({ ...editGroup, joinUrl: e.target.value })}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Status</label>
                <select
                  value={editGroup.status}
                  onChange={(e) => setEditGroup({ ...editGroup, status: e.target.value as GroupStatus })}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Link Health</label>
                <select
                  value={editGroup.linkStatus || "active"}
                  onChange={(e) => setEditGroup({ ...editGroup, linkStatus: e.target.value as any })}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Expired</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="font-bold text-muted-foreground mb-1 block">Logo Image URL</label>
                <input
                  value={editGroup.logoUrl}
                  onChange={(e) => setEditGroup({ ...editGroup, logoUrl: e.target.value })}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-bold text-muted-foreground mb-1 block">Description</label>
                <textarea
                  value={editGroup.description}
                  onChange={(e) => setEditGroup({ ...editGroup, description: e.target.value })}
                  className="w-full h-24 p-2.5 bg-muted/30 border border-border rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditGroup(null)} className="px-4 py-2 bg-muted rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Bulk Action Confirmation */}
      {bulkModalAction && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {bulkModalAction === "approve" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {bulkModalAction === "reject" && <XCircle className="w-5 h-5 text-amber-500" />}
                {bulkModalAction === "delete" && <Trash2 className="w-5 h-5 text-destructive" />}
                {bulkModalAction === "hide" && <EyeOff className="w-5 h-5 text-slate-500" />}
                {bulkModalAction === "unhide" && <Eye className="w-5 h-5 text-blue-500" />}
                {bulkModalAction === "feature" && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
                {bulkModalAction === "unfeature" && <Star className="w-5 h-5 text-muted-foreground" />}
                <span className="capitalize">Confirm Bulk {bulkModalAction}</span>
              </h2>
              <button
                type="button"
                onClick={() => setBulkModalAction(null)}
                disabled={isProcessingBulk}
                className="p-1.5 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {bulkModalAction === "delete" && (
                  <>
                    Are you sure you want to <strong className="text-destructive font-bold">PERMANENTLY DELETE</strong>{" "}
                    <strong>{selectedIds.length}</strong> selected group{selectedIds.length > 1 ? "s" : ""}? This action cannot be undone.
                  </>
                )}
                {bulkModalAction === "approve" && (
                  <>
                    Are you sure you want to approve <strong>{selectedIds.length}</strong> selected group{selectedIds.length > 1 ? "s" : ""}?
                    These communities will immediately become visible to all users.
                  </>
                )}
                {bulkModalAction === "reject" && (
                  <>
                    Are you sure you want to reject <strong>{selectedIds.length}</strong> selected group{selectedIds.length > 1 ? "s" : ""}?
                    Their status will be changed to rejected.
                  </>
                )}
                {bulkModalAction === "hide" && (
                  <>
                    Hide <strong>{selectedIds.length}</strong> selected group{selectedIds.length > 1 ? "s" : ""} from public view?
                  </>
                )}
                {bulkModalAction === "unhide" && (
                  <>
                    Unhide <strong>{selectedIds.length}</strong> selected group{selectedIds.length > 1 ? "s" : ""}?
                  </>
                )}
                {bulkModalAction === "feature" && (
                  <>
                    Mark <strong>{selectedIds.length}</strong> selected group{selectedIds.length > 1 ? "s" : ""} as featured?
                  </>
                )}
                {bulkModalAction === "unfeature" && (
                  <>
                    Remove featured badge from <strong>{selectedIds.length}</strong> selected group{selectedIds.length > 1 ? "s" : ""}?
                  </>
                )}
              </p>

              {/* Selected Groups Preview List */}
              <div className="border border-border rounded-2xl bg-muted/30 p-3 max-h-48 overflow-y-auto space-y-2">
                <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground border-b border-border/50 pb-1.5 mb-2">
                  <span>Selected Items ({selectedIds.length})</span>
                  <span>Platform</span>
                </div>
                {groups
                  .filter((g) => selectedIds.includes(g.id))
                  .map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-2 text-xs py-1 px-1 rounded-lg hover:bg-background/50">
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center font-bold text-[10px] flex-shrink-0 overflow-hidden">
                          {g.logoUrl ? <img src={g.logoUrl} alt="" className="w-full h-full object-cover" /> : g.name.substring(0, 1)}
                        </div>
                        <span className="font-semibold text-foreground truncate">{g.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted border border-border flex-shrink-0">
                        {g.platform}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setBulkModalAction(null)}
                disabled={isProcessingBulk}
                className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBulkAction}
                disabled={isProcessingBulk}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                  bulkModalAction === "delete"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : bulkModalAction === "approve"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : bulkModalAction === "reject"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {isProcessingBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm {bulkModalAction.charAt(0).toUpperCase() + bulkModalAction.slice(1)} ({selectedIds.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Submitter Inspector */}
      {inspectSubmitterUid && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Submitter Identity & History (Webmaster Only)
              </h2>
              <button onClick={() => setInspectSubmitterUid(null)} className="p-1.5 hover:bg-muted rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitterLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* Profile Header */}
                <div className="flex items-start gap-4 p-4 bg-muted/30 border border-border rounded-2xl">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary font-extrabold text-xl flex items-center justify-center overflow-hidden border border-border flex-shrink-0">
                    {submitterProfile?.photoURL ? (
                      <img src={submitterProfile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (submitterProfile?.displayName || "U").substring(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">
                        {submitterProfile?.displayName || "User Profile"}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-primary/10 text-primary">
                        {submitterProfile?.role || "user"}
                      </span>
                      {submitterProfile?.emailVerified && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" /> Email Verified
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground pt-1">
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-primary flex-shrink-0" /> {submitterProfile?.email || "No email"}
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> {(submitterProfile as any)?.phoneNumber || submitterProfile?.phone || "No phone"}
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <Shield className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" /> UID: {inspectSubmitterUid}
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> {[submitterProfile?.city, submitterProfile?.district, submitterProfile?.state].filter(Boolean).join(", ") || "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submission History Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-foreground">
                      Submission History ({submitterHistory.length} groups)
                    </h4>
                    <Link
                      href="/webmaster/users"
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      View in User Management →
                    </Link>
                  </div>

                  {submitterHistory.length === 0 ? (
                    <p className="p-4 bg-muted/20 rounded-xl text-muted-foreground text-center">
                      No group submissions found for this user.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {submitterHistory.map((g) => (
                        <div key={g.id} className="p-3 bg-card border border-border rounded-xl flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{g.name}</p>
                            <p className="text-[10px] text-muted-foreground">{g.platform} • {g.categoryName} • Joins: {g.joinCount || 0}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            g.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                            g.status === "rejected" ? "bg-destructive/10 text-destructive" :
                            "bg-amber-500/10 text-amber-600"
                          }`}>
                            {g.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <button onClick={() => setInspectSubmitterUid(null)} className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Permanent Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Group Permanently"
        description="Are you sure you want to permanently delete this group? All associated listings and details will be removed immediately. This action cannot be undone."
        confirmText="Delete Group"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteAction}
        loading={actionLoading === deleteConfirmId}
      />
    </div>
  );
}

function StatusBadge({ status, changesRequested }: { status: GroupStatus; changesRequested?: boolean }) {
  if (changesRequested) {
    return (
      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
        Changes Requested
      </span>
    );
  }
  switch (status) {
    case "approved":
      return (
        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
          Approved
        </span>
      );
    case "rejected":
      return (
        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
          Rejected
        </span>
      );
    default:
      return (
        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
          Pending
        </span>
      );
  }
}
