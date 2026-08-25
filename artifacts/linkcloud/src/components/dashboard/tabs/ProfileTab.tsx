import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  Edit3,
  Globe,
  Sparkles,
  Camera,
} from "lucide-react";
import type { UserProfile } from "@/lib/types";

interface ProfileTabProps {
  profile: UserProfile | null;
  email: string | null;
  isEmailVerified: boolean;
  pendingEmail?: string | null;
  onEditProfile: () => void;
  onOpenEmailModal: () => void;
  onOpenPhoneModal: () => void;
  onCheckEmailStatus: () => void;
}

export function ProfileTab({
  profile,
  email,
  isEmailVerified,
  pendingEmail,
  onEditProfile,
  onOpenEmailModal,
  onOpenPhoneModal,
  onCheckEmailStatus,
}: ProfileTabProps) {
  const displayName = profile?.displayName || "User";
  const userEmail = profile?.email || email || "No email";
  const activePendingEmail = pendingEmail || profile?.pendingEmail;
  const userPhone = profile?.phone || "";
  const isPhoneVerified = Boolean(profile?.phoneVerified);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profile Details</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personal information, contact credentials, and verified demographic records
            </p>
          </div>
        </div>

        <button
          onClick={onEditProfile}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm self-start sm:self-auto"
        >
          <Edit3 className="w-4 h-4" />
          <span>Edit Profile</span>
        </button>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
        {/* Avatar & Main Identity */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="relative group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-purple-100 dark:bg-purple-950 border-2 border-purple-200 dark:border-purple-800 overflow-hidden flex items-center justify-center font-bold text-2xl text-purple-700 dark:text-purple-300 shadow-sm flex-shrink-0">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                displayName.slice(0, 2).toUpperCase() || "US"
              )}
            </div>
            <button
              onClick={onEditProfile}
              className="absolute -bottom-1 -right-1 min-w-[44px] min-h-[44px] flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs shadow transition"
              title="Change Avatar"
              aria-label="Change Avatar"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {displayName}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 uppercase">
                {profile?.role || "USER"}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              {profile?.bio || "No bio added yet. Add a short bio to introduce yourself to communities."}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-500">
              <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">
                UID: {profile?.accountUid || "linkcloud----"}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Email Verification Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Email Address
              </span>
              {activePendingEmail ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="w-3 h-3" /> Change Pending
                </span>
              ) : isEmailVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="w-3 h-3" /> Unverified
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                {userEmail}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {(!isEmailVerified || activePendingEmail) && (
                  <button
                    onClick={onCheckEmailStatus}
                    className="min-h-[44px] px-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center"
                  >
                    Check Status
                  </button>
                )}
                <button
                  onClick={onOpenEmailModal}
                  className="min-h-[44px] px-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                >
                  {activePendingEmail ? "View Request" : "Change Email"}
                </button>
              </div>
            </div>

            {activePendingEmail && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                Pending verification link sent to: <span className="font-semibold text-slate-900 dark:text-white">{activePendingEmail}</span>
              </p>
            )}
          </div>

          {/* Mobile Verification Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Mobile Number
              </span>
              {isPhoneVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              ) : userPhone ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="w-3 h-3" /> Unverified
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Not Linked</span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                {userPhone || "No mobile number linked"}
              </span>
              <button
                onClick={onOpenPhoneModal}
                className="min-h-[44px] px-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center flex-shrink-0"
              >
                {userPhone ? "Update Mobile" : "+ Link Mobile"}
              </button>
            </div>
          </div>

          {/* Date of Birth */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Date of Birth
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {profile?.dob || "Not provided"}
            </span>
          </div>

          {/* Location Details */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Location (State / District / City)
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {[profile?.city, profile?.district, profile?.state, "India"]
                .filter(Boolean)
                .join(", ") || "India"}
            </span>
          </div>
        </div>

        {/* Address */}
        {profile?.address && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Full Residential Address
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200">{profile.address}</p>
          </div>
        )}
      </div>
    </div>
  );
}
