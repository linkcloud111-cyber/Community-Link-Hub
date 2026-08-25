import { useState } from "react";
import {
  CheckCircle2,
  ShieldAlert,
  Mail,
  Phone,
  Edit3,
  LogOut,
  ShieldCheck,
  User,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { UserProfile } from "@/lib/types";

interface DashboardHeaderProps {
  profile: UserProfile | null;
  email: string | null;
  isEmailVerified: boolean;
  onEditProfile: () => void;
  onLogout: () => void;
  isWebmaster?: boolean;
}

export function DashboardHeader({
  profile,
  email,
  isEmailVerified,
  onEditProfile,
  onLogout,
  isWebmaster = false,
}: DashboardHeaderProps) {
  const [copiedUid, setCopiedUid] = useState(false);

  const displayName = profile?.displayName || "User";
  const userEmail = profile?.email || email || "No email";
  const userPhone = profile?.phone || "";
  const isPhoneVerified = Boolean(profile?.phoneVerified);
  const accountUid = profile?.accountUid || ("linkcloud" + (profile?.uid ? profile.uid.substring(0, 6) : "------"));

  const handleCopyUid = () => {
    if (!accountUid) return;
    navigator.clipboard.writeText(accountUid);
    setCopiedUid(true);
    toast.success(`Account UID ${accountUid} copied to clipboard!`);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  // Status mapping
  const accountStatus = (profile?.status || "active").toUpperCase();
  const getStatusBadge = () => {
    switch (accountStatus) {
      case "BANNED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Banned
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Suspended
          </span>
        );
      case "ACTIVE":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "LC";
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
      {/* Top subtle brand accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left / Center: Avatar + Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-5 min-w-0 max-w-full">
          {/* Avatar and Quick Controls */}
          <div className="relative group flex-shrink-0">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border-2 border-purple-200 dark:border-purple-800 overflow-hidden flex items-center justify-center font-bold text-lg sm:text-2xl text-purple-700 dark:text-purple-300 shadow-sm">
              {profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <button
              onClick={onEditProfile}
              className="absolute -bottom-1 -right-1 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs shadow-md transition"
              title="Edit Profile"
              aria-label="Edit Profile Photo"
            >
              <User className="w-4 h-4" />
            </button>
          </div>

          {/* User Details */}
          <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1 max-w-full">
            {/* Status Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Welcome back,
              </span>
              {getStatusBadge()}
              {isWebmaster && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <ShieldCheck className="w-3 h-3" /> Webmaster
                </span>
              )}
            </div>

            {/* Display Name & UID */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0 max-w-full">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate max-w-full">
                {displayName}
              </h1>

              {/* Permanent Copyable UID */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/80 text-xs font-mono font-semibold text-purple-700 dark:text-purple-300 self-start max-w-full">
                <span className="text-[10px] uppercase font-sans text-purple-500 font-bold flex-shrink-0">UID:</span>
                <span className="truncate max-w-[140px] sm:max-w-none">{accountUid}</span>
                <button
                  id="copy-dashboard-uid-btn"
                  onClick={handleCopyUid}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-200/50 dark:hover:bg-purple-900/50 transition flex-shrink-0"
                  title="Copy permanent Account UID"
                  aria-label="Copy Account UID"
                >
                  {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Verification Badges & Contact Info */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-600 dark:text-slate-400 max-w-full">
              {/* Email */}
              <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 min-w-0 max-w-full">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate text-xs">{userEmail}</span>
                {isEmailVerified ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded flex-shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded flex-shrink-0">
                    <ShieldAlert className="w-2.5 h-2.5 text-amber-600" /> Unverified
                  </span>
                )}
              </div>

              {/* Mobile Number */}
              {userPhone ? (
                <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 min-w-0">
                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-xs">{userPhone}</span>
                  {isPhoneVerified ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded flex-shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded flex-shrink-0">
                      <ShieldAlert className="w-2.5 h-2.5 text-amber-600" /> Unverified
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
          <button
            id="dash-edit-profile-btn"
            onClick={onEditProfile}
            className="flex-1 sm:flex-initial min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950/50 dark:hover:text-purple-300 border border-slate-200 dark:border-slate-700 transition"
          >
            <Edit3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Edit Profile</span>
          </button>

          <button
            id="dash-logout-btn"
            onClick={onLogout}
            className="flex-1 sm:flex-initial min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
