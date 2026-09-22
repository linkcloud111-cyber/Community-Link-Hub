import { useState, useEffect } from "react";
import {
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  updateUserProfile,
  deleteUserAccountAdmin,
  toggleUserEmailVerified,
  toggleUserPhoneVerified,
  getDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
  getUserGroups,
  getUserFavorites,
  getUserNotifications,
} from "@/lib/firestore";
import type { UserProfile, DeletionRequest, AccountStatus, Group, Favorite, Notification } from "@/lib/types";
import { useLocation as useAppLocation } from "@/contexts/LocationContext";
import { useAuth } from "@/contexts/AuthContext";
import AdminNav from "@/components/admin-nav";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  Shield,
  Search,
  AlertTriangle,
  CheckCircle2,
  Ban,
  UserCheck,
  Trash2,
  Edit3,
  Eye,
  Mail,
  Phone,
  Check,
  X,
  Folder,
  Heart,
  Bell,
  MapPin,
  ShieldAlert,
  Download,
  BadgeCheck,
  Filter,
  RotateCcw,
  UserX,
  Calendar,
  RefreshCw,
  Info,
} from "lucide-react";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { states, getDistrictsForState } = useAppLocation();
  const [tab, setTab] = useState<"users" | "deletions">("users");

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  // User detail drawer modal
  const [viewUser, setViewUser] = useState<UserProfile | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [userFavs, setUserFavs] = useState<Favorite[]>([]);
  const [userNotifs, setUserNotifs] = useState<Notification[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Edit user modal
  const [editUser, setEditUser] = useState<UserProfile | null>(null);

  // Delete user confirmation modal
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserProfile | null>(null);

  // Suspend confirmation modal
  const [suspendTargetUser, setSuspendTargetUser] = useState<UserProfile | null>(null);

  // Ban confirmation modal
  const [banTargetUser, setBanTargetUser] = useState<UserProfile | null>(null);

  // Approve deletion confirmation modal
  const [approveTargetRequest, setApproveTargetRequest] = useState<DeletionRequest | null>(null);

  // Deletion request reject modal
  const [rejectTargetRequest, setRejectTargetRequest] = useState<DeletionRequest | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [uData, dData] = await Promise.all([getAllUsers(), getDeletionRequests()]);
      setUsers(uData);
      setDeletions(dData);
    } catch (err) {
      console.error("Error loading user administration data:", err);
      toast.error("Failed to load user administration data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open user inspector modal
  const handleInspectUser = async (user: UserProfile) => {
    setViewUser(user);
    setModalLoading(true);
    try {
      const [groups, favs, notifs] = await Promise.all([
        getUserGroups(user.uid),
        getUserFavorites(user.uid),
        getUserNotifications(user.uid),
      ]);
      setUserGroups(groups);
      setUserFavs(favs);
      setUserNotifs(notifs);
    } catch (err) {
      console.error("Error loading user details:", err);
      toast.error("Failed to load user activity records");
    } finally {
      setModalLoading(false);
    }
  };

  // Self protection check
  const isSelf = (uid: string) => {
    if (currentUser?.uid === uid) return true;
    const targetUser = users.find((u) => u.uid === uid);
    if (targetUser?.role === "webmaster") {
      return true;
    }
    return false;
  };

  const handleSetUserStatus = async (uid: string, targetStatus: AccountStatus) => {
    if (isSelf(uid)) {
      toast.error("Self-Protection: You cannot change status, suspend, or ban your active Webmaster account.");
      setSuspendTargetUser(null);
      setBanTargetUser(null);
      return;
    }

    const webmasterEmail = currentUser?.email || "webmaster@linkcloud.in";
    const webmasterUid = currentUser?.uid || "webmaster";

    setUpdating(uid);
    try {
      await updateUserStatus(uid, targetStatus, webmasterEmail, webmasterUid);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? {
                ...u,
                status: targetStatus,
                active: targetStatus === "active",
                suspended: targetStatus === "suspended",
                banned: targetStatus === "banned",
              }
            : u
        )
      );
      if (viewUser?.uid === uid) {
        setViewUser((prev) =>
          prev
            ? {
                ...prev,
                status: targetStatus,
                active: targetStatus === "active",
                suspended: targetStatus === "suspended",
                banned: targetStatus === "banned",
              }
            : null
        );
      }
      setSuspendTargetUser(null);
      setBanTargetUser(null);
      const actionLabel = targetStatus === "active" ? "activated & unsuspended" : targetStatus === "suspended" ? "suspended" : "banned";
      toast.success(`User account successfully ${actionLabel} in Firestore & Firebase Authentication.`);
      // Refresh list to keep counters and timestamps fully synchronized
      loadData();
    } catch (err: any) {
      console.error("Failed to update user status:", err);
      toast.error(err?.message || "Failed to update user status");
    } finally {
      setUpdating(null);
    }
  };

  const handleVerifyUserFully = async (uid: string) => {
    const webmasterEmail = currentUser?.email || "webmaster@linkcloud.in";
    const webmasterUid = currentUser?.uid || "webmaster";

    setUpdating(uid);
    try {
      await Promise.all([
        toggleUserEmailVerified(uid, true, webmasterEmail, webmasterUid),
        toggleUserPhoneVerified(uid, true, webmasterEmail, webmasterUid),
      ]);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, emailVerified: true, phoneVerified: true } : u))
      );
      if (viewUser?.uid === uid) {
        setViewUser((prev) => (prev ? { ...prev, emailVerified: true, phoneVerified: true } : null));
      }
      toast.success("User verified (Email & Phone verified in Firestore profile).");
    } catch (err: any) {
      console.error("Failed to verify user:", err);
      toast.error(err?.message || "Failed to verify user.");
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleEmailVerify = async (uid: string, current: boolean) => {
    const webmasterEmail = currentUser?.email || "webmaster@linkcloud.in";
    const webmasterUid = currentUser?.uid || "webmaster";

    setUpdating(uid);
    try {
      await toggleUserEmailVerified(uid, !current, webmasterEmail, webmasterUid);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, emailVerified: !current } : u)));
      if (viewUser?.uid === uid) {
        setViewUser((prev) => (prev ? { ...prev, emailVerified: !current } : null));
      }
      toast.success(!current ? "Email verified in profile" : "Email marked unverified in profile");
    } catch (err: any) {
      console.error("Failed to toggle email verification:", err);
      toast.error(err?.message || "Failed to update email verification");
    } finally {
      setUpdating(null);
    }
  };

  const handleTogglePhoneVerify = async (uid: string, current: boolean) => {
    const webmasterEmail = currentUser?.email || "webmaster@linkcloud.in";
    const webmasterUid = currentUser?.uid || "webmaster";

    setUpdating(uid);
    try {
      await toggleUserPhoneVerified(uid, !current, webmasterEmail, webmasterUid);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, phoneVerified: !current } : u)));
      if (viewUser?.uid === uid) {
        setViewUser((prev) => (prev ? { ...prev, phoneVerified: !current } : null));
      }
      toast.success(!current ? "Phone verified in profile" : "Phone marked unverified in profile");
    } catch (err: any) {
      console.error("Failed to toggle phone verification:", err);
      toast.error(err?.message || "Failed to update phone verification");
    } finally {
      setUpdating(null);
    }
  };

  const executeDeleteUserPermanently = async () => {
    if (!deleteTargetUser) return;
    const uid = deleteTargetUser.uid;

    if (isSelf(uid)) {
      toast.error("Self-Protection: You cannot delete your active Webmaster account.");
      setDeleteTargetUser(null);
      return;
    }

    const webmasterEmail = currentUser?.email || "webmaster@linkcloud.in";
    const webmasterUid = currentUser?.uid || "webmaster";

    setUpdating(uid);
    try {
      await deleteUserAccountAdmin(uid, webmasterEmail, webmasterUid);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      if (viewUser?.uid === uid) setViewUser(null);
      setDeleteTargetUser(null);
      toast.success("User account and associated application records permanently deleted from Firestore and Authentication.");
      loadData();
    } catch (err: any) {
      console.error("Failed to delete user account:", err);
      toast.error(err?.message || "Failed to delete user account");
    } finally {
      setUpdating(null);
    }
  };

  const executeApproveDeletion = async () => {
    if (!approveTargetRequest) return;
    const requestId = approveTargetRequest.id;
    const uid = approveTargetRequest.uid;

    if (isSelf(uid)) {
      toast.error("Self-Protection: You cannot approve deletion of your active Webmaster account.");
      setApproveTargetRequest(null);
      return;
    }

    const webmasterEmail = currentUser?.email || "webmaster@linkcloud.in";
    const webmasterUid = currentUser?.uid || "webmaster";

    setUpdating(requestId);
    try {
      await approveDeletionRequest(requestId, uid, webmasterEmail, webmasterUid);
      setDeletions((prev) => prev.filter((d) => d.id !== requestId));
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      if (viewUser?.uid === uid) setViewUser(null);
      setApproveTargetRequest(null);
      toast.success("Account deletion request approved. User profile, records, and auth credentials permanently purged.");
      loadData();
    } catch (err: any) {
      console.error("Failed to approve deletion request:", err);
      toast.error(err?.message || "Failed to approve deletion request.");
    } finally {
      setUpdating(null);
    }
  };

  const executeRejectDeletion = async () => {
    if (!rejectTargetRequest) return;
    if (!rejectReasonInput.trim()) {
      toast.error("Please provide a reason for rejecting this deletion request.");
      return;
    }
    const requestId = rejectTargetRequest.id;
    const uid = rejectTargetRequest.uid;

    const webmasterEmail = currentUser?.email || "webmaster@linkcloud.in";
    const webmasterUid = currentUser?.uid || "webmaster";

    setUpdating(requestId);
    try {
      await rejectDeletionRequest(
        requestId,
        uid,
        webmasterEmail,
        webmasterUid,
        rejectReasonInput.trim()
      );
      setDeletions((prev) => prev.filter((d) => d.id !== requestId));
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, deletionRequested: false } : u)));
      if (viewUser?.uid === uid) {
        setViewUser((prev) => (prev ? { ...prev, deletionRequested: false } : null));
      }
      setRejectTargetRequest(null);
      setRejectReasonInput("");
      toast.success("Account deletion request rejected. User notified and 7-day cooldown applied.");
      loadData();
    } catch (err: any) {
      console.error("Failed to reject deletion request:", err);
      toast.error(err?.message || "Failed to reject deletion request.");
    } finally {
      setUpdating(null);
    }
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    setUpdating(editUser.uid);
    try {
      await updateUserProfile(editUser.uid, {
        displayName: editUser.displayName,
        phone: editUser.phone,
        state: editUser.state,
        district: editUser.district,
        city: editUser.city,
        bio: editUser.bio,
      });

      console.log("[WEBMASTER USERS]", {
        Action: "EDIT_USER_PROFILE",
        UID: editUser.uid,
        CurrentWebmaster: currentUser?.email || "webmaster@linkcloud.in",
        Authorized: true,
        UpdatedFields: {
          displayName: editUser.displayName,
          phone: editUser.phone,
          state: editUser.state,
          district: editUser.district,
          city: editUser.city,
          bio: editUser.bio,
        },
        FirestoreResult: "SUCCESS",
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editUser.uid
            ? {
                ...u,
                displayName: editUser.displayName,
                phone: editUser.phone,
                state: editUser.state,
                district: editUser.district,
                city: editUser.city,
                bio: editUser.bio,
              }
            : u
        )
      );

      if (viewUser?.uid === editUser.uid) {
        setViewUser((prev) =>
          prev
            ? {
                ...prev,
                displayName: editUser.displayName,
                phone: editUser.phone,
                state: editUser.state,
                district: editUser.district,
                city: editUser.city,
                bio: editUser.bio,
              }
            : null
        );
      }

      toast.success("User profile updated successfully in Firestore");
      setEditUser(null);
    } catch (err: any) {
      console.error("Failed to update user profile:", err);
      toast.error(err?.message || "Failed to update user profile");
    } finally {
      setUpdating(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      toast.info("No user records to export.");
      return;
    }

    const headers = [
      "Account UID",
      "Firebase UID",
      "Full Name",
      "Email Address",
      "Email Verified",
      "Phone Number",
      "Phone Verified",
      "Role",
      "Status",
      "State",
      "District",
      "City",
      "Bio",
    ];

    const rows = filteredUsers.map((u) => [
      `"${u.accountUid || ""}"`,
      `"${u.uid || ""}"`,
      `"${(u.displayName || "").replace(/"/g, '""')}"`,
      `"${u.email || ""}"`,
      u.emailVerified ? "TRUE" : "FALSE",
      `"${u.phone || ""}"`,
      u.phoneVerified ? "TRUE" : "FALSE",
      u.role || "user",
      u.status || "active",
      `"${(u.state || "").replace(/"/g, '""')}"`,
      `"${(u.district || "").replace(/"/g, '""')}"`,
      `"${(u.city || "").replace(/"/g, '""')}"`,
      `"${(u.bio || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `linkcloud-users-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredUsers.length} user records to linkcloud-users-${dateStr}.csv`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setStateFilter("all");
    setDistrictFilter("all");
  };

  const filteredUsers = users.filter((u) => {
    if (search) {
      const s = search.toLowerCase().trim();
      const matchSearch =
        u.displayName?.toLowerCase().includes(s) ||
        u.accountUid?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.phone?.toLowerCase().includes(s) ||
        u.state?.toLowerCase().includes(s) ||
        u.district?.toLowerCase().includes(s) ||
        u.city?.toLowerCase().includes(s) ||
        u.uid?.toLowerCase().includes(s);
      if (!matchSearch) return false;
    }

    if (statusFilter !== "all") {
      if (statusFilter === "pending_verification") {
        if (u.emailVerified && u.phoneVerified) return false;
      } else if (statusFilter === "pending_deletion") {
        if (!u.deletionRequested && u.status !== "deleted") return false;
      } else if ((u.status || "active") !== statusFilter) {
        return false;
      }
    }

    if (stateFilter !== "all" && u.state !== stateFilter) {
      return false;
    }

    if (districtFilter !== "all" && u.district !== districtFilter) {
      return false;
    }

    return true;
  });

  const pendingDeletions = deletions.filter((d) => d.status === "pending");
  const activeCount = users.filter((u) => !u.status || u.status === "active").length;
  const suspendedCount = users.filter((u) => u.status === "suspended").length;
  const bannedCount = users.filter((u) => u.status === "banned").length;
  const unverifiedCount = users.filter((u) => !u.emailVerified || !u.phoneVerified).length;
  const hasActiveFilters = search || statusFilter !== "all" || stateFilter !== "all" || districtFilter !== "all";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" /> User Management Console
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage registered accounts, verifications, status, and deletion requests. Single Webmaster security active.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-bold rounded-xl transition flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          title="Reload User Data from Firestore"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Data
        </button>
      </div>

      {/* Admin Nav */}
      <AdminNav stats={{ pendingDeletions: pendingDeletions.length }} />

      {/* Metrics Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Users</p>
            <p className="text-xl font-extrabold">{users.length}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Users</p>
            <p className="text-xl font-extrabold text-emerald-600">{activeCount}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Suspended / Banned</p>
            <p className="text-xl font-extrabold text-amber-600">{suspendedCount + bannedCount}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Deletion Requests</p>
            <p className="text-xl font-extrabold text-rose-600">{pendingDeletions.length}</p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === "users"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All Users ({users.length})
        </button>

        <button
          onClick={() => setTab("deletions")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            tab === "deletions"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Account Deletion Requests ({pendingDeletions.length})
        </button>
      </div>

      {tab === "users" && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Status Filter, State Filter, District Filter, CSV Export */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 bg-card border border-border rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, phone, state, district, UID..."
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 bg-background border border-border rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="pending_deletion">Pending Deletion</option>
                <option value="pending_verification">Unverified Accounts</option>
              </select>

              {/* State Filter */}
              <select
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setDistrictFilter("all");
                }}
                className="py-2 px-3 bg-background border border-border rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="all">All States</option>
                {states.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* District Filter */}
              {stateFilter !== "all" && (
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="py-2 px-3 bg-background border border-border rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="all">All Districts</option>
                  {getDistrictsForState(stateFilter).map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="p-2 text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  title="Reset all search filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              )}
            </div>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> Export CSV ({filteredUsers.length})
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground">
              <UserX className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="font-bold text-base">No user accounts found matching criteria.</p>
              <p className="text-xs text-muted-foreground mt-1">Try clearing filters or search terms.</p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold text-foreground"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
              <div className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const self = isSelf(u.uid);
                  const isSuspended = u.status === "suspended";
                  const isBanned = u.status === "banned";
                  const isDeleted = u.status === "deleted";

                  return (
                    <div
                      key={u.uid}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 hover:bg-muted/20 transition-colors ${
                        self ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs uppercase overflow-hidden flex-shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.displayName?.substring(0, 2) || "US"
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm truncate">{u.displayName || "Anonymous User"}</p>

                            {self && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Current Webmaster
                              </span>
                            )}

                            {isSuspended && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                Suspended
                              </span>
                            )}

                            {isBanned && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                Banned
                              </span>
                            )}

                            {isDeleted && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                Deleted
                              </span>
                            )}

                            {u.emailVerified ? (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center gap-0.5" title="Email Verified in Firestore Profile">
                                <Check className="w-3 h-3" /> Email
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-0.5" title="Email Unverified">
                                <X className="w-3 h-3" /> Email
                              </span>
                            )}

                            {u.phoneVerified ? (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 flex items-center gap-0.5" title="Phone Verified in Firestore Profile">
                                <Check className="w-3 h-3" /> Phone
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-0.5" title="Phone Unverified">
                                <X className="w-3 h-3" /> Phone
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                            <span>{u.email || u.phone || "No Contact"}</span>
                            {u.accountUid && (
                              <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-foreground/80" title="Immutable Account UID">
                                {u.accountUid}
                              </span>
                            )}
                            {u.state && <span className="opacity-75">• {u.state}{u.district ? `, ${u.district}` : ""}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                          u.role === "webmaster" ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground"
                        }`}>
                          {u.role === "webmaster" ? (
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Webmaster</span>
                          ) : (
                            "User"
                          )}
                        </span>

                        {/* Verify Button if Unverified */}
                        {(!u.emailVerified || !u.phoneVerified) && (
                          <button
                            onClick={() => handleVerifyUserFully(u.uid)}
                            disabled={updating === u.uid}
                            className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                            title="Verify Email & Phone for this account"
                          >
                            {updating === u.uid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><BadgeCheck className="w-3.5 h-3.5" /> Verify</>}
                          </button>
                        )}

                        {!self ? (
                          <>
                            {/* Suspend / Unsuspend */}
                            {isSuspended ? (
                              <button
                                onClick={() => handleSetUserStatus(u.uid, "active")}
                                disabled={updating === u.uid}
                                className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                                title="Unsuspend and activate user account"
                              >
                                {updating === u.uid ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Activating...
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" /> Unsuspend
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => setSuspendTargetUser(u)}
                                disabled={updating === u.uid}
                                className="px-2.5 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                                title="Suspend account access temporarily"
                              >
                                {updating === u.uid ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Suspending...
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3.5 h-3.5" /> Suspend
                                  </>
                                )}
                              </button>
                            )}

                            {/* Ban / Unban */}
                            {isBanned ? (
                              <button
                                onClick={() => handleSetUserStatus(u.uid, "active")}
                                disabled={updating === u.uid}
                                className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                                title="Unban user account"
                              >
                                {updating === u.uid ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Activating...
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" /> Unban
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => setBanTargetUser(u)}
                                disabled={updating === u.uid}
                                className="px-2.5 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                                title="Ban user account from platform"
                              >
                                {updating === u.uid ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Banning...
                                  </>
                                ) : (
                                  <>
                                    <ShieldAlert className="w-3.5 h-3.5" /> Ban
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        ) : null}

                        <button
                          onClick={() => handleInspectUser(u)}
                          className="p-1.5 bg-muted/60 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1 transition"
                          title="View Full User Details & Activity"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>

                        <button
                          onClick={() => setEditUser(u)}
                          className="p-1.5 bg-muted/60 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary text-xs font-semibold transition"
                          title="Edit User Profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>

                        {!self && (
                          <button
                            onClick={() => setDeleteTargetUser(u)}
                            disabled={updating === u.uid}
                            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition disabled:opacity-50"
                            title="Delete User Permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "deletions" && (
        <div className="space-y-4">
          {pendingDeletions.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-50" />
              <p className="font-bold text-base">No pending account deletion requests.</p>
              <p className="text-xs text-muted-foreground mt-1">All user account deletion requests have been processed.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs divide-y divide-border">
              {pendingDeletions.map((d) => (
                <div key={d.id} className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base">{d.displayName || "LinkCloud User"}</h3>
                      <p className="text-xs text-muted-foreground">{d.email} | {d.phone || "No Phone"} | UID: {d.uid}</p>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-amber-500/10 text-amber-600 rounded-full w-max">
                      Pending Approval
                    </span>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-xl text-xs text-foreground font-mono">
                    <strong>Reason for Deletion:</strong> "{d.reason || "No explicit reason provided"}"
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setApproveTargetRequest(d)}
                      disabled={updating === d.id}
                      className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition"
                    >
                      {updating === d.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" /> Approve Deletion
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setRejectTargetRequest(d);
                        setRejectReasonInput("");
                      }}
                      disabled={updating === d.id}
                      className="px-4 py-2 bg-muted text-foreground hover:bg-muted/80 rounded-xl text-xs font-bold disabled:opacity-50 transition"
                    >
                      {updating === d.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rejecting...
                        </>
                      ) : (
                        "Reject Request"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inspect User Drawer Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> User Inspector Profile
              </h2>
              <button onClick={() => setViewUser(null)} className="p-1.5 hover:bg-muted rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {viewUser.photoURL ? <img src={viewUser.photoURL} alt="" className="w-full h-full object-cover" /> : viewUser.displayName?.substring(0, 2) || "US"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  {viewUser.displayName || "No Name"}
                  {isSelf(viewUser.uid) && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      You (Webmaster)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">{viewUser.email || "No Email"} | {viewUser.phone || "No phone"}</p>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => handleToggleEmailVerify(viewUser.uid, viewUser.emailVerified)}
                    disabled={updating === viewUser.uid}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                      viewUser.emailVerified ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    title="Toggle LinkCloud Profile Email Verification"
                  >
                    {viewUser.emailVerified ? "✓ Email Verified (Click to Revoke)" : "× Verify Email"}
                  </button>
                  <button
                    onClick={() => handleTogglePhoneVerify(viewUser.uid, viewUser.phoneVerified)}
                    disabled={updating === viewUser.uid}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                      viewUser.phoneVerified ? "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    title="Toggle LinkCloud Profile Phone Verification"
                  >
                    {viewUser.phoneVerified ? "✓ Phone Verified (Click to Revoke)" : "× Verify Phone"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-card border border-border rounded-xl">
              <div>
                <span className="text-muted-foreground font-semibold">Account UID (Immutable):</span>
                <p className="font-mono text-[11px] select-all truncate text-primary font-bold">{viewUser.accountUid || "None (Legacy)"}</p>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Firebase Auth UID:</span>
                <p className="font-mono text-[11px] select-all truncate">{viewUser.uid}</p>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Role / Status:</span>
                <p className="font-bold capitalize">{viewUser.role || "user"} ({viewUser.status || "active"})</p>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Location:</span>
                <p className="font-medium">{viewUser.state ? `${viewUser.state}${viewUser.district ? `, ${viewUser.district}` : ""}${viewUser.city ? `, ${viewUser.city}` : ""}` : "Not provided"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground font-semibold">Bio:</span>
                <p className="font-medium italic truncate">{viewUser.bio || "No bio"}</p>
              </div>
            </div>

            {modalLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-primary" /> Submitted Groups ({userGroups.length})
                  </h4>
                  {userGroups.length === 0 ? (
                    <p className="text-muted-foreground italic bg-muted/20 p-3 rounded-xl">No groups submitted yet by this account.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {userGroups.map((g) => (
                        <div key={g.id} className="p-2.5 bg-muted/40 rounded-xl flex items-center justify-between gap-2">
                          <span className="font-bold truncate">{g.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              g.status === "approved" ? "bg-emerald-500/10 text-emerald-600" : g.status === "pending" ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive"
                            }`}>
                              {g.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/30 rounded-xl">
                    <h4 className="font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-rose-500" /> Favorites
                    </h4>
                    <p className="font-extrabold text-base">{userFavs.length} Bookmarks</p>
                  </div>

                  <div className="p-3 bg-muted/30 rounded-xl">
                    <h4 className="font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-blue-500" /> Notifications
                    </h4>
                    <p className="font-extrabold text-base">{userNotifs.length} Sent</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setEditUser(viewUser);
                    setViewUser(null);
                  }}
                  className="px-3.5 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                </button>

                {!isSelf(viewUser.uid) && (
                  <>
                    {viewUser.status === "suspended" ? (
                      <button
                        onClick={() => handleSetUserStatus(viewUser.uid, "active")}
                        disabled={updating === viewUser.uid}
                        className="px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {updating === viewUser.uid ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Activating...
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" /> Unsuspend
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setSuspendTargetUser(viewUser)}
                        disabled={updating === viewUser.uid}
                        className="px-3 py-2 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {updating === viewUser.uid ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Suspending...
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5" /> Suspend
                          </>
                        )}
                      </button>
                    )}

                    {viewUser.status === "banned" ? (
                      <button
                        onClick={() => handleSetUserStatus(viewUser.uid, "active")}
                        disabled={updating === viewUser.uid}
                        className="px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {updating === viewUser.uid ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Activating...
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" /> Unban
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setBanTargetUser(viewUser)}
                        disabled={updating === viewUser.uid}
                        className="px-3 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {updating === viewUser.uid ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Banning...
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" /> Ban
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setDeleteTargetUser(viewUser);
                        setViewUser(null);
                      }}
                      className="px-3 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>

              <button onClick={() => setViewUser(null)} className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveUserEdit} className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" /> Edit User Profile
              </h2>
              <button type="button" onClick={() => setEditUser(null)} className="p-1.5 hover:bg-muted rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Full Name</label>
                <input
                  value={editUser.displayName || ""}
                  onChange={(e) => setEditUser({ ...editUser, displayName: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">
                  Email Address <span className="text-[10px] font-normal text-muted-foreground">(Managed via Auth)</span>
                </label>
                <input
                  type="email"
                  value={editUser.email || ""}
                  disabled
                  className="w-full p-2.5 bg-muted/40 border border-border rounded-xl outline-none text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Mobile Phone Number</label>
                <input
                  value={editUser.phone || ""}
                  onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">State</label>
                  <input
                    value={editUser.state || ""}
                    onChange={(e) => setEditUser({ ...editUser, state: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">District</label>
                  <input
                    value={editUser.district || ""}
                    onChange={(e) => setEditUser({ ...editUser, district: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">City</label>
                <input
                  value={editUser.city || ""}
                  onChange={(e) => setEditUser({ ...editUser, city: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground mb-1 block">Bio / Notes</label>
                <textarea
                  value={editUser.bio || ""}
                  onChange={(e) => setEditUser({ ...editUser, bio: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Short user description or administrative notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 bg-muted rounded-xl text-xs font-bold transition hover:bg-muted/80">
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating === editUser.uid}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                {updating === editUser.uid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-3 bg-destructive/10 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Permanently Delete Account?</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl text-xs space-y-1.5 font-mono">
              <p><strong>User:</strong> {deleteTargetUser.displayName || "Unknown"}</p>
              <p><strong>Email:</strong> {deleteTargetUser.email || "None"}</p>
              <p><strong>UID:</strong> {deleteTargetUser.uid}</p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4" /> Data Purge Scope
              </div>
              <p>
                This will permanently delete the user's Firestore profile, saved bookmarks/favorites, notifications, and account deletion requests.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 bg-muted rounded-xl text-xs font-bold hover:bg-muted/80 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteUserPermanently}
                disabled={updating === deleteTargetUser.uid}
                className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {updating === deleteTargetUser.uid ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Confirm Permanent Deletion
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Deletion Request Modal */}
      {rejectTargetRequest && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-500/10 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Reject Account Deletion Request</h3>
                <p className="text-xs text-muted-foreground">Provide reason for rejection</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl text-xs space-y-1.5 font-mono">
              <p><strong>User:</strong> {rejectTargetRequest.displayName || "Unknown"}</p>
              <p><strong>Email:</strong> {rejectTargetRequest.email}</p>
              <p><strong>User Reason:</strong> "{rejectTargetRequest.reason}"</p>
            </div>

            <div>
              <label className="font-bold text-xs text-muted-foreground mb-1 block">Rejection Reason / Notes</label>
              <textarea
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                rows={2}
                placeholder="E.g., User has active pending group submissions; identity could not be verified."
                className="w-full p-2.5 bg-background border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTargetRequest(null);
                  setRejectReasonInput("");
                }}
                className="px-4 py-2 bg-muted rounded-xl text-xs font-bold hover:bg-muted/80 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRejectDeletion}
                disabled={updating === rejectTargetRequest.id}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {updating === rejectTargetRequest.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {suspendTargetUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-500/10 rounded-2xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Suspend User Account?</h3>
                <p className="text-xs text-muted-foreground">Temporarily restrict platform access</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl text-xs space-y-1.5 font-mono">
              <p><strong>User:</strong> {suspendTargetUser.displayName || "Unknown"}</p>
              <p><strong>Email:</strong> {suspendTargetUser.email || "None"}</p>
              <p><strong>UID:</strong> {suspendTargetUser.uid}</p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4" /> Suspension Scope & Firebase Admin SDK Action
              </div>
              <p>
                The user account status will be set to suspended in Firestore and their Firebase Authentication account will be disabled with session tokens revoked. The user will be blocked from creating or modifying groups, reviews, and bookmarks.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendTargetUser(null)}
                className="px-4 py-2 bg-muted rounded-xl text-xs font-bold hover:bg-muted/80 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSetUserStatus(suspendTargetUser.uid, "suspended")}
                disabled={updating === suspendTargetUser.uid}
                className="px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {updating === suspendTargetUser.uid ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Suspending...
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" /> Confirm Suspension
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Confirmation Modal */}
      {banTargetUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-3 bg-destructive/10 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Ban User Account?</h3>
                <p className="text-xs text-muted-foreground">Block user account access permanently</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl text-xs space-y-1.5 font-mono">
              <p><strong>User:</strong> {banTargetUser.displayName || "Unknown"}</p>
              <p><strong>Email:</strong> {banTargetUser.email || "None"}</p>
              <p><strong>UID:</strong> {banTargetUser.uid}</p>
            </div>

            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs text-destructive space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4" /> Banning Scope & Firebase Admin SDK Action
              </div>
              <p>
                The account status will be permanently set to banned in Firestore and disabled via Firebase Authentication with all session tokens revoked. The user will be immediately barred from accessing protected LinkCloud features.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBanTargetUser(null)}
                className="px-4 py-2 bg-muted rounded-xl text-xs font-bold hover:bg-muted/80 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSetUserStatus(banTargetUser.uid, "banned")}
                disabled={updating === banTargetUser.uid}
                className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {updating === banTargetUser.uid ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Banning...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" /> Confirm Ban
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Deletion Request Modal */}
      {approveTargetRequest && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-3 bg-destructive/10 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Approve Permanent Account Deletion?</h3>
                <p className="text-xs text-muted-foreground">Irreversible Firestore data purge</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl text-xs space-y-1.5 font-mono">
              <p><strong>User:</strong> {approveTargetRequest.displayName || "Unknown"}</p>
              <p><strong>Email:</strong> {approveTargetRequest.email}</p>
              <p><strong>UID:</strong> {approveTargetRequest.uid}</p>
              <p><strong>User Reason:</strong> "{approveTargetRequest.reason || "None"}"</p>
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-700 dark:text-rose-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4" /> Permanent Purge Action
              </div>
              <p>
                Approving this request will permanently remove the user's Firestore profile, bookmarks, notifications, and mark this deletion request as approved.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveTargetRequest(null)}
                className="px-4 py-2 bg-muted rounded-xl text-xs font-bold hover:bg-muted/80 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeApproveDeletion}
                disabled={updating === approveTargetRequest.id}
                className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {updating === approveTargetRequest.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Approve & Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
