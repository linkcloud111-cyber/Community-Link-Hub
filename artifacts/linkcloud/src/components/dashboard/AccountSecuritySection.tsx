import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Calendar,
  KeyRound,
  Trash2,
  Lock,
  UserX,
  FileWarning,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type { UserProfile } from "@/lib/types";

interface AccountSecuritySectionProps {
  profile: UserProfile | null;
  email: string | null;
  isEmailVerified: boolean;
  onRequestDeletion: (reason: string) => Promise<void>;
  onCancelDeletion: () => Promise<void>;
  onOpenChangePassword?: () => void;
}

export function AccountSecuritySection({
  profile,
  email,
  isEmailVerified,
  onRequestDeletion,
  onCancelDeletion,
  onOpenChangePassword,
}: AccountSecuritySectionProps) {
  const [copiedUid, setCopiedUid] = useState(false);
  const [deletionModalOpen, setDeletionModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Time ticker for countdown
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const accountUid = profile?.accountUid || "linkcloud" + (profile?.uid ? profile.uid.substring(0, 5) : "----");

  const handleCopyUid = () => {
    if (!accountUid) return;
    navigator.clipboard.writeText(accountUid);
    setCopiedUid(true);
    toast.success(`Account UID ${accountUid} copied to clipboard!`);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  // Format dates
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date =
        timestamp.toDate?.() ||
        (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "N/A";
    }
  };

  const memberSince = formatDate(profile?.createdAt);
  const lastLogin = formatDate(profile?.updatedAt || profile?.createdAt);

  // Calculate Deletion Status
  const getDeletionStatus = (): "NONE" | "PENDING" | "REJECTED" | "APPROVED" | "COMPLETED" | "CANCELLED" => {
    if (!profile) return "NONE";
    const status = profile.deletionStatus?.toUpperCase();
    if (status === "PENDING" || (profile.deletionRequested && status !== "REJECTED" && status !== "CANCELLED" && status !== "COMPLETED")) {
      return "PENDING";
    }
    if (status === "REJECTED") return "REJECTED";
    if (status === "APPROVED") return "APPROVED";
    if (status === "COMPLETED") return "COMPLETED";
    if (status === "CANCELLED") return "CANCELLED";
    return "NONE";
  };

  const currentDeletionState = getDeletionStatus();

  // Cooldown calculation for REJECTED state
  const getCooldownInfo = () => {
    if (currentDeletionState !== "REJECTED") return null;
    let cooldownEndMs = 0;
    if (profile?.deletionCooldownUntil) {
      cooldownEndMs =
        profile.deletionCooldownUntil.toMillis?.() ??
        (typeof profile.deletionCooldownUntil === "number"
          ? profile.deletionCooldownUntil
          : new Date(profile.deletionCooldownUntil).getTime());
    } else if (profile?.deletionRejectedAt) {
      const rejectedTime =
        profile.deletionRejectedAt.toMillis?.() ??
        (typeof profile.deletionRejectedAt === "number"
          ? profile.deletionRejectedAt
          : new Date(profile.deletionRejectedAt).getTime());
      cooldownEndMs = rejectedTime + 7 * 24 * 60 * 60 * 1000;
    }

    const remainingMs = cooldownEndMs - currentTime;
    if (remainingMs <= 0) {
      return { active: false, days: 0, hours: 0, minutes: 0, text: "Cooldown period expired." };
    }

    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    let text = "";
    if (days > 0) text = `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`;
    else if (hours > 0) text = `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    else text = `${Math.max(1, minutes)} minute${minutes !== 1 ? "s" : ""}`;

    return { active: true, days, hours, minutes, text };
  };

  const cooldownInfo = getCooldownInfo();

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please provide a reason for your deletion request.");
      return;
    }
    if (!confirmedCheck) {
      toast.error("Please check the confirmation box to proceed.");
      return;
    }

    setSubmitting(true);
    try {
      await onRequestDeletion(reason.trim());
      setDeletionModalOpen(false);
      setReason("");
      setConfirmedCheck(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit deletion request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteCancel = async () => {
    setCancelling(true);
    try {
      await onCancelDeletion();
      setCancelModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel deletion request.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ACCOUNT SECURITY CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                Account Security & Identification
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Immutable identifier, authentication status, and session metadata
              </p>
            </div>
          </div>
          {onOpenChangePassword && (
            <button
              onClick={onOpenChangePassword}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 transition flex-shrink-0 self-start sm:self-auto"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </button>
          )}
        </div>

        {/* 4-Item Grid for Account Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Account Status */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Account Status
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {profile?.status || "ACTIVE"}
              </span>
            </div>
          </div>

          {/* 2. Account UID */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Account UID (Permanent)
            </span>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="font-mono text-sm font-bold text-purple-700 dark:text-purple-300 truncate">
                {accountUid}
              </span>
              <button
                id="copy-account-uid-btn"
                onClick={handleCopyUid}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition flex-shrink-0"
                title="Copy Account UID"
                aria-label="Copy Account UID"
              >
                {copiedUid ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3. Member Since */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Member Since
            </span>
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block truncate">
              {memberSince}
            </span>
          </div>

          {/* 4. Verification Badges */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Verification Badges
            </span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> Email
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <ShieldAlert className="w-3 h-3" /> Email
                </span>
              )}

              {profile?.phoneVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> Mobile
                </span>
              ) : profile?.phone ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <ShieldAlert className="w-3 h-3" /> Mobile
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">No Mobile</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACCOUNT DELETION CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                Account Deletion & Privacy Controls
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Permanent deletion request lifecycle governed by Webmaster review
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="self-start sm:self-auto flex-shrink-0">
            {currentDeletionState === "PENDING" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" /> PENDING REVIEW
              </span>
            )}
            {currentDeletionState === "REJECTED" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase tracking-wider">
                <XCircle className="w-3.5 h-3.5" /> REJECTED
              </span>
            )}
            {currentDeletionState === "CANCELLED" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                CANCELLED
              </span>
            )}
            {currentDeletionState === "NONE" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                NO ACTIVE REQUEST
              </span>
            )}
          </div>
        </div>

        {/* Webmaster Protection Notice */}
        {profile?.role === "webmaster" ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
            <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-purple-900 dark:text-purple-200">
                Master Webmaster Security Protection Active
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                This is the primary administrative account for LinkCloud. Account self-deletion is restricted to ensure continuous platform governance.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* STATE 1: NONE or CANCELLED */}
            {(currentDeletionState === "NONE" || currentDeletionState === "CANCELLED") && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    You haven't submitted an account deletion request.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Submitting a deletion request will notify the Webmaster to permanently purge your private account data.
                  </p>
                </div>

                <button
                  id="open-deletion-modal-btn"
                  onClick={() => setDeletionModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Request Account Deletion</span>
                </button>
              </div>
            )}

        {/* STATE 2: PENDING */}
        {currentDeletionState === "PENDING" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Deletion Request Pending Review
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    Your account deletion request has been submitted and is awaiting Webmaster review. Once approved, your private account data will be permanently purged.
                  </p>
                </div>
              </div>

              {/* Request Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-xs">
                <div>
                  <span className="text-amber-700/80 dark:text-amber-400/80 font-medium">Request Date:</span>
                  <span className="ml-1.5 font-semibold text-amber-950 dark:text-amber-100">
                    {formatDate(profile?.deletionRequestedAt)}
                  </span>
                </div>
                <div>
                  <span className="text-amber-700/80 dark:text-amber-400/80 font-medium">Review Status:</span>
                  <span className="ml-1.5 font-semibold text-amber-950 dark:text-amber-100">
                    Awaiting Webmaster Review
                  </span>
                </div>
                {profile?.deletionReason && (
                  <div className="sm:col-span-2">
                    <span className="text-amber-700/80 dark:text-amber-400/80 font-medium">Provided Reason:</span>
                    <p className="mt-0.5 p-2 rounded-lg bg-amber-100/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 italic">
                      "{profile.deletionReason}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Cancel Request Button */}
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Need to keep your account? You can withdraw your request prior to approval.
              </span>
              <button
                id="cancel-deletion-request-btn"
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 transition flex-shrink-0"
              >
                <span>Cancel Request</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 3: REJECTED */}
        {currentDeletionState === "REJECTED" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-3">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    Deletion Request Rejected by Webmaster
                  </h4>
                  <p className="text-xs text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                    Your previous request for account deletion was reviewed and rejected. An exact 7-day security cooldown is enforced before a new request can be submitted.
                  </p>
                </div>
              </div>

              {/* Rejection Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-rose-200/60 dark:border-rose-800/40 text-xs">
                <div>
                  <span className="text-rose-700/80 dark:text-rose-400/80 font-medium">Rejection Date:</span>
                  <span className="ml-1.5 font-semibold text-rose-950 dark:text-rose-100">
                    {formatDate(profile?.deletionRejectedAt)}
                  </span>
                </div>
                <div>
                  <span className="text-rose-700/80 dark:text-rose-400/80 font-medium">Cooldown Status:</span>
                  <span className="ml-1.5 font-semibold text-rose-950 dark:text-rose-100">
                    {cooldownInfo?.active ? `${cooldownInfo.text} remaining` : "Cooldown expired"}
                  </span>
                </div>
                {profile?.deletionRejectionReason && (
                  <div className="sm:col-span-2">
                    <span className="text-rose-700/80 dark:text-rose-400/80 font-medium">Webmaster Reason:</span>
                    <p className="mt-0.5 p-2.5 rounded-lg bg-rose-100/70 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 font-medium">
                      "{profile.deletionRejectionReason}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar based on Cooldown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Info className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span>
                  {cooldownInfo?.active
                    ? `New deletion requests can be submitted after ${cooldownInfo.text}.`
                    : "The 7-day cooldown period has ended. You may now submit a new request if needed."}
                </span>
              </div>

              <button
                id="request-deletion-again-btn"
                onClick={() => setDeletionModalOpen(true)}
                disabled={Boolean(cooldownInfo?.active)}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 ${
                  cooldownInfo?.active
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                    : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800"
                }`}
                title={cooldownInfo?.active ? `Cooldown active (${cooldownInfo.text} remaining)` : "Submit fresh request"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Request Account Deletion Again</span>
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* MODAL 1: REQUEST ACCOUNT DELETION */}
      {deletionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => !submitting && setDeletionModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-rose-50/50 dark:bg-rose-950/20">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-300 flex-shrink-0">
                <FileWarning className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Request Permanent Account Deletion
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  LinkCloud Account UID: <span className="font-mono font-bold text-purple-600">{accountUid}</span>
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitRequest} className="p-5 space-y-4">
              {/* Warning Box */}
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Important Privacy Notice</span>
                </div>
                <p className="leading-relaxed">
                  This action will permanently remove your LinkCloud account and private account data after Webmaster approval. Once purged, your account cannot be recovered.
                </p>
              </div>

              {/* Reason Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Reason for Account Deletion <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="deletion-reason-input"
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please specify why you wish to delete your LinkCloud account..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none"
                />
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="confirm-deletion-checkbox"
                  checked={confirmedCheck}
                  onChange={(e) => setConfirmedCheck(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-600 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                  I understand that account deletion is permanent and cannot be undone once approved by the Webmaster.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setDeletionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  id="submit-deletion-request-btn"
                  disabled={submitting || !confirmedCheck || !reason.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CANCEL DELETION REQUEST */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => !cancelling && setCancelModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-300 flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Deletion Request
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Withdraw your pending deletion request
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to cancel your pending account deletion request? Your LinkCloud account will remain fully active.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
              >
                Back
              </button>

              <button
                type="button"
                id="confirm-cancel-deletion-btn"
                disabled={cancelling}
                onClick={handleExecuteCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition shadow-sm"
              >
                {cancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Confirm Withdrawal</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
