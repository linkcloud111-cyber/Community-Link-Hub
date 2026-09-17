import { useState, useEffect } from "react";
import {
  Settings,
  Bell,
  Shield,
  Save,
  Check,
  Mail,
  Eye,
  Send,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import type { UserProfile } from "@/lib/types";
import { auth } from "@/lib/firebase";
import {
  resendVerificationEmail,
  resendPendingEmailVerification,
  resendVerificationEmailSecure,
  EMAIL_RESEND_COOLDOWN_MS,
  EMAIL_CHANGE_TTL_MS,
} from "@/lib/auth";
import { EmailVerificationPreviewModal } from "@/components/dashboard/EmailVerificationPreviewModal";

interface SettingsTabProps {
  profile: UserProfile | null;
  email?: string | null;
  isEmailVerified?: boolean;
  pendingEmail?: string | null;
  onSavePreferences: (prefs: any) => Promise<void>;
  onCheckEmailStatus?: () => void;
}

interface ResendFeedbackInfo {
  sentAt: number;
  targetEmail: string;
  expiresInMins: number;
}

export function SettingsTab({
  profile,
  email,
  isEmailVerified = false,
  pendingEmail,
  onSavePreferences,
  onCheckEmailStatus,
}: SettingsTabProps) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [groupApprovalAlerts, setGroupApprovalAlerts] = useState(true);
  const [showPhonePublicly, setShowPhonePublicly] = useState(false);
  const [saving, setSaving] = useState(false);

  // Email Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);

  // Resend State & Feedback Loop
  const [resending, setResending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendFeedback, setResendFeedback] = useState<ResendFeedbackInfo | null>(null);

  const currentUser = auth.currentUser;
  const currentEmail = email || profile?.email || currentUser?.email || "No email";
  const effectivePendingEmail = pendingEmail || profile?.pendingEmail;
  const targetEmailForVerification = effectivePendingEmail || currentEmail;
  const verified = Boolean(isEmailVerified || profile?.emailVerified || currentUser?.emailVerified);

  // Initialize Cooldown from LocalStorage
  useEffect(() => {
    if (typeof window === "undefined" || !currentUser?.uid) return;
    const cooldownKey = `resend_email_change_${currentUser.uid}`;
    const lastSent = Number(window.localStorage.getItem(cooldownKey) || 0);
    const now = Date.now();
    const elapsed = now - lastSent;
    if (lastSent && elapsed < EMAIL_RESEND_COOLDOWN_MS) {
      setCooldown(Math.ceil((EMAIL_RESEND_COOLDOWN_MS - elapsed) / 1000));
    }
  }, [currentUser?.uid]);

  // Cooldown countdown interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSavePreferences({
        emailAlerts,
        groupApprovalAlerts,
        showPhonePublicly,
      });
      toast.success("Preferences updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResendEmail = async () => {
    if (resending || cooldown > 0) return;

    if (!currentUser) {
      toast.error("Please sign in to resend verification email.");
      return;
    }

    setResending(true);
    try {
      if (effectivePendingEmail) {
        await resendPendingEmailVerification(currentUser, effectivePendingEmail);
      } else {
        await resendVerificationEmail(currentUser);
      }

      const cooldownSecs = Math.floor(EMAIL_RESEND_COOLDOWN_MS / 1000); // 30 seconds
      setCooldown(cooldownSecs);
      if (typeof window !== "undefined" && currentUser?.uid) {
        window.localStorage.setItem(`resend_email_change_${currentUser.uid}`, String(Date.now()));
      }
      setResendFeedback({
        sentAt: Date.now(),
        targetEmail: targetEmailForVerification,
        expiresInMins: Math.round(EMAIL_CHANGE_TTL_MS / 60000), // 15 minutes
      });

      toast.success(`Verification email sent to ${targetEmailForVerification}!`, {
        description: "Please check your inbox and spam/junk folder.",
      });
    } catch (err: any) {
      // If default helper failed with specific message, surface it
      toast.error(err.message || "Failed to send verification email. Please try again later.");
    } finally {
      setResending(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (checkingStatus) return;
    setCheckingStatus(true);
    try {
      if (onCheckEmailStatus) {
        await onCheckEmailStatus();
      } else if (currentUser) {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          toast.success("Email verified successfully!");
        } else {
          toast.info("Verification email not confirmed yet. Please check your inbox.");
        }
      }
    } catch (err: any) {
      toast.error("Could not check verification status. Please try again.");
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              Account Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Notification delivery, email verification, and privacy controls
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition shadow-sm self-start sm:self-auto flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>

      {/* EMAIL VERIFICATION & DELIVERY SECTION */}
      <div
        id="lc_settings_email_verification_section"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Email Verification & Delivery
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {verified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Verified Account</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Verification Pending</span>
              </span>
            )}
          </div>
        </div>

        {/* Email Details Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Registered Email
                </span>
                {effectivePendingEmail && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    Change in progress
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate font-mono">
                {currentEmail}
              </p>
              {effectivePendingEmail && (
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Target pending email: <strong>{effectivePendingEmail}</strong>
                </p>
              )}
            </div>

            {/* Action Buttons: Preview & Resend */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Preview Button */}
              <button
                type="button"
                id="lc_preview_verification_email_btn"
                onClick={() => setPreviewOpen(true)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 border border-purple-200/80 dark:border-purple-800/80 transition"
              >
                <Eye className="w-4 h-4" />
                <span>Preview Email</span>
              </button>

              {/* Resend Button with Cooldown */}
              <button
                type="button"
                id="lc_resend_verification_email_btn"
                onClick={handleResendEmail}
                disabled={resending || cooldown > 0}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition shadow-sm"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Resend in {cooldown}s</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Resend Verification Email</span>
                  </>
                )}
              </button>

              {/* Check / Refresh Status Button for unverified users or users with pending email change */}
              {(!verified || Boolean(effectivePendingEmail)) && (
                <button
                  type="button"
                  id="lc_refresh_verification_status_btn"
                  onClick={handleRefreshStatus}
                  disabled={checkingStatus}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Check if you have already clicked the link in your inbox"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingStatus ? "animate-spin" : ""}`} />
                  <span>Refresh Status</span>
                </button>
              )}
            </div>
          </div>

          {/* CLEAR FEEDBACK LOOP BANNER */}
          {resendFeedback && (
            <div
              id="lc_resend_feedback_banner"
              className="mt-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-900 dark:text-emerald-200 space-y-2 animate-in fade-in duration-200"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="font-bold">Verification email sent successfully!</p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Dispatched to <strong className="font-mono">{resendFeedback.targetEmail}</strong> at{" "}
                    {new Date(resendFeedback.sentAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    . The link will remain active for{" "}
                    <strong>{resendFeedback.expiresInMins} minutes</strong>.
                  </p>
                </div>
              </div>

              <div className="pl-6 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-1">
                  <Inbox className="w-3 h-3" /> Check Spam or Junk folder if not in Primary
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Sender: noreply@linkcloud.in
                </span>
              </div>
            </div>
          )}

          {/* Verification Helper Tip */}
          {!verified && !resendFeedback && (
            <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <Info className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>
                Clicking the link in your email immediately verifies your address. You can preview the template format using the <strong>Preview Email</strong> button above.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notifications Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Bell className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Email & Notification Preferences
          </h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer min-h-[56px] gap-4">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Group Approval & Status Notifications
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Receive instant emails when a Webmaster approves or rejects your submitted group.
              </p>
            </div>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
              <input
                type="checkbox"
                checked={groupApprovalAlerts}
                onChange={(e) => setGroupApprovalAlerts(e.target.checked)}
                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-600 cursor-pointer accent-purple-600"
              />
            </div>
          </label>

          <label className="flex items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer min-h-[56px] gap-4">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Security & Verification Alerts
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Important security notices regarding password resets, logins, and account reviews.
              </p>
            </div>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-600 cursor-pointer accent-purple-600"
              />
            </div>
          </label>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Shield className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Directory Privacy Controls
          </h3>
        </div>

        <label className="flex items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer min-h-[56px] gap-4">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Public Contact Visibility
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Display your verified mobile number on your submitted group directory cards.
            </p>
          </div>
          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
            <input
              type="checkbox"
              checked={showPhonePublicly}
              onChange={(e) => setShowPhonePublicly(e.target.checked)}
              className="w-5 h-5 rounded text-purple-600 focus:ring-purple-600 cursor-pointer accent-purple-600"
            />
          </div>
        </label>
      </div>

      {/* EMAIL VERIFICATION PREVIEW MODAL */}
      <EmailVerificationPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        email={currentEmail}
        isEmailVerified={verified}
        pendingEmail={effectivePendingEmail}
        displayName={profile?.displayName || currentUser?.displayName || "Member"}
        accountUid={profile?.accountUid}
        onResend={handleResendEmail}
        resending={resending}
        cooldown={cooldown}
      />
    </div>
  );
}
