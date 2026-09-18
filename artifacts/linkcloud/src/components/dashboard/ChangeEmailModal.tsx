import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Mail,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Send,
  Ban,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { signInWithCustomToken } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { UserProfile } from "@/lib/types";
import { validateNewGmail, STRICT_EMAIL_REGEX } from "@/lib/utils";
import {
  updateUserEmailAddress,
  resendPendingEmailVerification,
  cancelPendingEmailChange,
  checkIsEmailRegistered,
  checkAndSyncEmailChangeStatus,
  commitEmailChangeInFirestore,
  getActiveEmailChangeRequest,
  markActiveEmailRequestExpired,
  EMAIL_CHANGE_TTL_MS,
  EMAIL_RESEND_COOLDOWN_MS,
} from "@/lib/auth";
import {
  EmailVerificationTooltip,
  EmailVerificationHelperText,
} from "@/components/dashboard/EmailVerificationHelper";

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  profile: UserProfile | null;
  pendingEmail?: string | null;
  onSuccess?: () => Promise<void> | void;
}

type FieldStatus = "neutral" | "valid" | "invalid";

interface SyncStatusFeedback {
  type: "success" | "error" | "warning" | "info";
  message: string;
}

export function ChangeEmailModal({
  isOpen,
  onClose,
  user,
  profile,
  pendingEmail: initialPendingEmail,
  onSuccess,
}: ChangeEmailModalProps) {
  const [, setLocation] = useLocation();
  const { refreshProfile, startSessionHandoff, endSessionHandoff } = useAuth();
  const currentEmail = user?.email || profile?.email || "";

  // Check pending email from profile or localStorage
  const activePendingEmail =
    initialPendingEmail ||
    profile?.pendingEmail ||
    (typeof window !== "undefined" && user?.uid
      ? window.localStorage.getItem(`pending_email_${user.uid}`)
      : null);

  const [activePending, setActivePending] = useState<string | null>(activePendingEmail);

  // Form input states (start empty)
  const [newEmail, setNewEmail] = useState("");
  const [confirmNewEmail, setConfirmNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Loading & action states
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // 60-second resend cooldown & 60-second expiration timers
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  // Confirmation dialog for Cancel & Close
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Status feedback card state
  const [statusFeedback, setStatusFeedback] = useState<SyncStatusFeedback | null>(null);

  // Touched states for user interaction
  const [touchedNewEmail, setTouchedNewEmail] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  // Real-time asynchronous email registration check state
  const [checkingRegistered, setCheckingRegistered] = useState(false);
  const [registeredError, setRegisteredError] = useState<string | null>(null);

  // Password authentication error state
  const [passwordAuthError, setPasswordAuthError] = useState<string | null>(null);

  // Ref to cancel stale async registration checks
  const checkReqSeqRef = useRef(0);
  const prevOpenRef = useRef(isOpen);

  // Reset form inputs & synchronize pending email state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setNewEmail("");
      setConfirmNewEmail("");
      setCurrentPassword("");
      setShowPassword(false);
      setPasswordAuthError(null);
      setRegisteredError(null);
      setCheckingRegistered(false);
      setSending(false);
      setResending(false);
      setRefreshing(false);
      setCancelling(false);
      setShowCancelConfirm(false);
      setStatusFeedback(null);
      setTouchedNewEmail(false);
      setTouchedConfirm(false);
      setTouchedPassword(false);

      if (!prevOpenRef.current || !activePending) {
        const detectedPending =
          initialPendingEmail ||
          profile?.pendingEmail ||
          (typeof window !== "undefined" && user?.uid
            ? window.localStorage.getItem(`pending_email_${user.uid}`)
            : null);
        if (detectedPending) {
          setActivePending(detectedPending);
        }
      }

      // Check active 30-second resend cooldown & 15-minute expiration from localStorage
      if (typeof window !== "undefined" && user?.uid) {
        const lastSent = Number(
          window.localStorage.getItem(`resend_email_change_${user.uid}`) || 0
        );
        const elapsed = Date.now() - lastSent;
        if (elapsed < EMAIL_RESEND_COOLDOWN_MS) {
          setCooldown(Math.ceil((EMAIL_RESEND_COOLDOWN_MS - elapsed) / 1000));
        } else {
          setCooldown(0);
        }

        const expiresTimestamp = Number(
          window.localStorage.getItem(`pending_email_expires_${user.uid}`) || 0
        );
        if (expiresTimestamp > 0) {
          const remaining = Math.max(0, Math.ceil((expiresTimestamp - Date.now()) / 1000));
          setExpiresIn(remaining);
        } else {
          setExpiresIn(Math.floor(EMAIL_CHANGE_TTL_MS / 1000));
        }
      }
    }
    prevOpenRef.current = isOpen;
    return () => {
      setNewEmail("");
      setConfirmNewEmail("");
      setCurrentPassword("");
      setShowPassword(false);
      setPasswordAuthError(null);
      setRegisteredError(null);
      setCheckingRegistered(false);
      setSending(false);
      setResending(false);
      setRefreshing(false);
      setCancelling(false);
      setShowCancelConfirm(false);
      setStatusFeedback(null);
      setTouchedNewEmail(false);
      setTouchedConfirm(false);
      setTouchedPassword(false);
    };
  }, [isOpen, initialPendingEmail, profile?.pendingEmail, user?.uid, activePending]);

  // Debounced real-time check for already-registered email
  useEffect(() => {
    if (!isOpen || activePending) return;

    const trimmed = newEmail.trim();
    if (!trimmed) {
      setRegisteredError(null);
      setCheckingRegistered(false);
      return;
    }

    const check = validateNewGmail(trimmed, currentEmail);
    if (!check.valid || check.isCurrent) {
      setRegisteredError(null);
      setCheckingRegistered(false);
      return;
    }

    const currentReqSeq = ++checkReqSeqRef.current;
    setCheckingRegistered(true);

    const debounceTimer = setTimeout(async () => {
      try {
        const isRegistered = await checkIsEmailRegistered(check.cleanEmail, user?.uid);
        if (checkReqSeqRef.current === currentReqSeq) {
          if (isRegistered) {
            setRegisteredError("This Gmail is already registered.");
          } else {
            setRegisteredError(null);
          }
        }
      } catch {
        if (checkReqSeqRef.current === currentReqSeq) {
          setRegisteredError(null);
        }
      } finally {
        if (checkReqSeqRef.current === currentReqSeq) {
          setCheckingRegistered(false);
        }
      }
    }, 280);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [newEmail, currentEmail, isOpen, activePending, user?.uid]);

  // 60-Second Cooldown countdown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 60-Second Expiration countdown timer effect
  useEffect(() => {
    if (!isOpen || !activePending || expiresIn === null) return;
    if (expiresIn <= 0) {
      // If countdown expired, mark status as expired asynchronously
      if (user?.uid) {
        markActiveEmailRequestExpired(user.uid).catch(() => {});
      }
      return;
    }

    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, activePending, expiresIn, user?.uid]);

  // Real-time Validations
  const newEmailCheck = validateNewGmail(newEmail, currentEmail);

  // Field 1: New Email Status
  let newEmailStatus: FieldStatus = "neutral";
  let newEmailError: string | null = null;

  if (touchedNewEmail || newEmail.length > 0) {
    if (!newEmail.trim()) {
      newEmailStatus = "invalid";
      newEmailError = "New email is required.";
    } else if (!newEmailCheck.valid) {
      newEmailStatus = "invalid";
      newEmailError = newEmailCheck.error || "Please enter a valid Gmail address.";
    } else if (registeredError) {
      newEmailStatus = "invalid";
      newEmailError = registeredError;
    } else if (!checkingRegistered) {
      newEmailStatus = "valid";
    }
  }

  // Field 2: Confirm New Email Status
  let confirmStatus: FieldStatus = "neutral";
  let confirmError: string | null = null;

  if (touchedConfirm || confirmNewEmail.length > 0) {
    if (!confirmNewEmail.trim()) {
      confirmStatus = "invalid";
      confirmError = "Please confirm your new email address.";
    } else if (newEmailStatus !== "valid" && !newEmailCheck.valid) {
      confirmStatus = "neutral";
    } else if (newEmail.trim().toLowerCase() !== confirmNewEmail.trim().toLowerCase()) {
      confirmStatus = "invalid";
      confirmError = "Email addresses do not match.";
    } else {
      confirmStatus = "valid";
    }
  }

  // Field 3: Current Password Status
  let passwordStatus: FieldStatus = "neutral";
  let passwordError: string | null = null;

  if (touchedPassword || currentPassword.length > 0) {
    if (!currentPassword) {
      passwordStatus = "invalid";
      passwordError = "Current password is required.";
    } else if (passwordAuthError) {
      passwordStatus = "invalid";
      passwordError = passwordAuthError;
    } else {
      passwordStatus = "valid";
    }
  }

  // Handle Close Attempt (shows cancel confirm if active pending request exists)
  const handleRequestClose = () => {
    if (activePending) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  // 1. Submit email change request (Screen 1)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to change your email.");
      return;
    }

    setTouchedNewEmail(true);
    setTouchedConfirm(true);
    setTouchedPassword(true);

    const cleanInput = newEmail.trim().toLowerCase();
    if (!cleanInput || !STRICT_EMAIL_REGEX.test(cleanInput)) {
      toast.error("Please enter a valid, active email address.");
      return;
    }

    const currentClean = (currentEmail || "").trim().toLowerCase();
    if (currentClean && cleanInput === currentClean) {
      toast.error("New email must be different from your current email.");
      return;
    }

    const check = validateNewGmail(newEmail, currentEmail);
    if (!check.valid) {
      toast.error(check.error || "Please enter a valid, active email address.");
      return;
    }

    if (registeredError) {
      toast.error(registeredError);
      return;
    }

    if (!confirmNewEmail.trim()) {
      toast.error("Please confirm your new email address.");
      return;
    }

    if (cleanInput !== confirmNewEmail.trim().toLowerCase()) {
      toast.error("Email addresses do not match.");
      return;
    }

    if (!currentPassword) {
      setPasswordAuthError(null);
      toast.error("Current password is required.");
      return;
    }

    setSending(true);
    setStatusFeedback(null);
    try {
      await updateUserEmailAddress(
        user,
        check.cleanEmail,
        currentPassword,
        profile?.displayName
      );

      setActivePending(check.cleanEmail);
      setCooldown(Math.floor(EMAIL_RESEND_COOLDOWN_MS / 1000));
      setExpiresIn(Math.floor(EMAIL_CHANGE_TTL_MS / 1000));
      setStatusFeedback({
        type: "info",
        message: "ℹ Verification link sent. Link is valid for 5 minutes.",
      });
      toast.info("Verification email sent. Please check your Gmail.");

      // Clear password and form inputs immediately
      setCurrentPassword("");
      setPasswordAuthError(null);
      setRegisteredError(null);
      setNewEmail("");
      setConfirmNewEmail("");
      setTouchedNewEmail(false);
      setTouchedConfirm(false);
      setTouchedPassword(false);
    } catch (err: any) {
      setCurrentPassword("");
      const rawCode = err?.code || "";
      const rawMsg = String(err?.message || "");
      let errorMsg = err?.message || "Failed to initiate email change.";

      if (
        rawCode === "auth/wrong-password" ||
        rawCode === "auth/invalid-credential" ||
        rawCode === "auth/invalid-login-credentials" ||
        msgIncludesPasswordError(rawMsg)
      ) {
        errorMsg = "Incorrect password. Please enter your current password and try again.";
        setPasswordAuthError(errorMsg);
      } else if (
        rawCode === "auth/email-already-in-use" ||
        rawMsg.includes("email-already-in-use") ||
        rawMsg.includes("already registered")
      ) {
        errorMsg = "This Gmail is already registered.";
        setRegisteredError(errorMsg);
        setPasswordAuthError(null);
      } else {
        setPasswordAuthError(null);
      }

      toast.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  // Helper for password error match
  function msgIncludesPasswordError(msg: string) {
    return (
      msg.includes("wrong-password") ||
      msg.includes("invalid-credential") ||
      msg.includes("invalid-login-credentials") ||
      msg.includes("Incorrect current password") ||
      msg.includes("Incorrect password")
    );
  }

  // 2. Resend verification link (Screen 2 Action)
  const handleResend = async () => {
    if (!user || !activePending || resending || cooldown > 0) return;
    setResending(true);
    setStatusFeedback(null);
    try {
      await resendPendingEmailVerification(user, activePending);
      setCooldown(Math.floor(EMAIL_RESEND_COOLDOWN_MS / 1000));
      setExpiresIn(Math.floor(EMAIL_CHANGE_TTL_MS / 1000));
      setStatusFeedback({
        type: "info",
        message: "ℹ A new verification link has been sent. Link is valid for 5 minutes.",
      });
      toast.info("Verification link sent again. Please check your Gmail inbox.");
    } catch (err: any) {
      const msg = err?.message || "Unable to resend verification link. Please try again.";
      setStatusFeedback({
        type: "error",
        message: `× ${msg}`,
      });
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  // 3. Refresh verification status / Manual Refresh (Screen 2 Action) - STRICTLY READ-ONLY
  const handleManualRefresh = async () => {
    if (!user || refreshing) return;
    setRefreshing(true);
    setStatusFeedback(null);
    try {
      // 1. Fetch Firestore Request State (Strictly READ-ONLY - NO writes, NO token refreshes with revoked token)
      let activeReqDoc: any = null;
      let targetEmail: string = activePending || "";
      let activeRequestId: string | null = null;
      try {
        const dbRef = doc(db, `users/${user.uid}/emailChanges`, "active");
        const requestDoc = await getDoc(dbRef);
        if (requestDoc.exists()) {
          const reqData = requestDoc.data();
          if (reqData.targetEmail) {
            targetEmail = reqData.targetEmail;
          }
          if (reqData.requestId) {
            activeRequestId = reqData.requestId;
            const fullReqSnap = await getDoc(doc(db, "emailChangeRequests", reqData.requestId));
            if (fullReqSnap.exists()) {
              activeReqDoc = fullReqSnap.data();
            }
          }
        }
      } catch (dbErr) {
        console.warn("[REFRESH STATUS READ-ONLY] Direct requestDoc check notice:", dbErr);
      }

      if (!activeReqDoc) {
        activeReqDoc = await getActiveEmailChangeRequest(user.uid);
        if (activeReqDoc?.requestId) {
          activeRequestId = activeReqDoc.requestId;
        }
        if (activeReqDoc?.newEmail) {
          targetEmail = activeReqDoc.newEmail;
        }
      }

      const status = (activeReqDoc?.status || "").toLowerCase();
      const isCompleted = status === "completed" || status === "verified";

      if (isCompleted) {
        // Request fresh session via Custom Token from server
        startSessionHandoff();
        try {
          const res = await fetch("/api/email-change/session-refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: user.uid,
              requestId: activeRequestId || `req_${user.uid}`,
            }),
          });
          const data = await res.json();
          if (res.ok && data?.customToken) {
            console.log("[REFRESH STATUS READ-ONLY] Fresh custom token received, establishing valid session...");
            await signInWithCustomToken(auth, data.customToken);
            await refreshProfile();
          }
        } catch (tokenErr) {
          console.warn("[REFRESH STATUS READ-ONLY] Session refresh token notice:", tokenErr);
        } finally {
          endSessionHandoff();
        }

        // Clean up local storage tracking
        if (typeof window !== "undefined" && window.localStorage) {
          try {
            window.localStorage.removeItem(`pending_email_${user.uid}`);
            window.localStorage.removeItem(`pending_email_req_${user.uid}`);
            window.localStorage.removeItem(`pending_email_expires_${user.uid}`);
            window.localStorage.removeItem(`resend_email_change_${user.uid}`);
          } catch {}
        }

        // Clean up modal state
        setActivePending(null);
        setNewEmail("");
        setConfirmNewEmail("");
        setCurrentPassword("");
        setShowPassword(false);
        setExpiresIn(null);
        setCooldown(0);
        setStatusFeedback(null);
        onClose();

        if (onSuccess) {
          await onSuccess();
        }

        // Navigate directly to /dashboard?tab=profile
        setLocation("/dashboard?tab=profile", { replace: true });
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/dashboard?tab=profile");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
        toast.success("Email updated successfully");
        return;
      } else if (status === "expired" || (activeReqDoc?.expiresAt && Date.now() > activeReqDoc.expiresAt)) {
        setStatusFeedback({
          type: "error",
          message: "× Verification link expired. Please resend the link.",
        });
        setExpiresIn(0);
        toast.warning("Verification link expired. Please send a new verification link.");
      } else if (status === "cancelled") {
        setStatusFeedback({
          type: "error",
          message: "× Verification link cancelled.",
        });
        toast.error("Verification link has been cancelled.");
      } else if (status === "superseded") {
        setStatusFeedback({
          type: "error",
          message: "× This is an older verification link. Please use the latest link.",
        });
        toast.warning("This is an older verification link. Please use the latest link.");
      } else {
        setStatusFeedback({
          type: "warning",
          message: "Email not verified yet. Please open the verification link sent to your inbox or spam folder.",
        });
        toast.info("Email not verified yet. Please open the verification link sent to your inbox or spam folder.");
      }
    } catch (error: any) {
      console.error("[REFRESH STATUS READ-ONLY] Status check error:", error);
      setStatusFeedback({
        type: "warning",
        message: "Email not verified yet. Please open the verification link sent to your inbox or spam folder.",
      });
      toast.info("Email not verified yet. Please open the verification link sent to your inbox or spam folder.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshStatus = handleManualRefresh;

  // 4. Confirm Cancel & Close (Screen 2 Action)
  const handleConfirmCancel = async () => {
    if (!user || cancelling) return;
    setCancelling(true);
    try {
      await cancelPendingEmailChange(user, activePending);
      setActivePending(null);
      setShowCancelConfirm(false);
      toast.success("Email change request cancelled.");
      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel email change.");
      setCancelling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="lc_change_email_modal_root" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        id="lc_change_email_backdrop"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleRequestClose}
      />

      {/* Modal Container */}
      <div
        id="lc_change_email_dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lc_change_email_title"
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/70 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 id="lc_change_email_title" className="text-base font-bold text-slate-900 dark:text-white">
                {activePending ? "📧 Verification Pending" : "Change Email"}
              </h3>
              <p className="text-xs text-slate-500">
                {activePending ? "Check your Gmail to verify" : "Requires Gmail address (@gmail.com)"}
              </p>
            </div>
          </div>
          <button
            id="lc_change_email_close_btn"
            onClick={handleRequestClose}
            disabled={sending || resending || refreshing || cancelling}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Email Reference Box */}
        <div id="lc_current_email_box" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              Current Email Address
            </span>
            {user?.emailVerified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-2.5 h-2.5" /> Verified
              </span>
            )}
          </div>
          <span id="lc_current_email_display" className="text-xs font-bold text-slate-900 dark:text-white break-all">
            {currentEmail || "No email currently set"}
          </span>
        </div>

        {/* Status Feedback Banner */}
        {statusFeedback && (
          <div
            id="lc_status_feedback_box"
            role="status"
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-150 ${
              statusFeedback.type === "success"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : statusFeedback.type === "error"
                ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200"
                : statusFeedback.type === "warning"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
                : "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200"
            }`}
          >
            {statusFeedback.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            {statusFeedback.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            {statusFeedback.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
            {statusFeedback.type === "info" && <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            <span>{statusFeedback.message}</span>
          </div>
        )}

        {/* Cancel Confirmation Dialog */}
        {showCancelConfirm && activePending && (
          <div
            id="lc_cancel_confirm_dialog"
            className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 space-y-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Cancel Email Change?</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              Are you sure you want to cancel this email change? The verification link already sent to your email will no longer work.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                id="lc_cancel_confirm_keep_btn"
                disabled={cancelling}
                onClick={() => setShowCancelConfirm(false)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition"
              >
                Keep Waiting
              </button>
              <button
                type="button"
                id="lc_cancel_confirm_cancel_btn"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition shadow-xs"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Cancel Email Change</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* PENDING VERIFICATION STATE PANEL & 3 MANDATORY BUTTONS (Screen 2) */}
        {activePending && (
          <div id="lc_pending_verification_panel" className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
                <Mail className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                    VERIFICATION PENDING
                  </span>
                  {/* 5-Minute Expiration Timer (04:59 ... 00:00) */}
                  <span
                    id="lc_expiration_timer_badge"
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                      expiresIn !== null && expiresIn <= 0
                        ? "bg-rose-200 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                        : "bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {expiresIn !== null && expiresIn <= 0
                      ? "⏱️ Expired"
                      : expiresIn !== null
                      ? `⏱️ ${String(Math.floor(expiresIn / 60)).padStart(2, "0")}:${String(expiresIn % 60).padStart(2, "0")}`
                      : "⏱️ 05:00"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  We sent a verification link to:
                </p>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 shadow-xs">
                  <span id="lc_pending_email_address" className="text-sm font-bold text-slate-900 dark:text-white break-all select-all">
                    {activePending}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed pt-1">
                  ⏱️ Link is valid for 5 minutes. Please check your Gmail inbox and verify.
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  After clicking the verification link, return here and tap <strong>Refresh Status</strong>.
                </p>
              </div>
            </div>

            {/* Screen 2 Actions: 1. Refresh Status 2. Resend Link (30s Cooldown) 3. Cancel & Close */}
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Refresh Status Button */}
                <button
                  type="button"
                  id="lc_refresh_status_btn"
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>🔄 Refresh Verification Status</span>
                    </>
                  )}
                </button>

                {/* 2. Resend Link Button (Active with 30-second cooldown) */}
                <button
                  type="button"
                  id="lc_resend_verification_btn"
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  title={cooldown > 0 ? `Resend available in ${cooldown} seconds` : "Resend Verification Email"}
                  className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    cooldown > 0 || resending
                      ? "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 opacity-70 cursor-not-allowed"
                      : "text-amber-800 dark:text-amber-200 bg-amber-100/80 hover:bg-amber-200/80 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 border border-amber-300 dark:border-amber-700/60 shadow-xs"
                  }`}
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>📩 Resend in {cooldown}s</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>📩 Resend Verification Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3. Cancel & Close Button */}
              <div className="pt-1">
                <button
                  type="button"
                  id="lc_cancel_and_close_btn"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelling}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>❌ Cancel & Close</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Email Form (only shown if not in pending mode) */}
        {!activePending && (
          <form id="lc_change_email_form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
            {/* Decoy fields to trap browser credential autofill heuristics */}
            <input
              type="text"
              name="fake_user_autofill_sink"
              id="fake_user_autofill_sink"
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="username"
              className="sr-only opacity-0 pointer-events-none absolute -left-[9999px] h-0 w-0"
            />
            <input
              type="password"
              name="fake_pass_autofill_sink"
              id="fake_pass_autofill_sink"
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="current-password"
              className="sr-only opacity-0 pointer-events-none absolute -left-[9999px] h-0 w-0"
            />

            {/* Field 1: New Gmail Address */}
            <div id="lc_field_group_new_gmail" className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="lc_target_new_gmail" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>New Gmail Address</span>
                  <span className="text-rose-500">*</span>
                  <EmailVerificationTooltip side="right" />
                </label>
                <span className="text-[10px] font-medium text-slate-400">Requires verification link</span>
              </div>
              <div className="relative">
                <input
                  type="email"
                  name="lc_target_new_gmail"
                  id="lc_target_new_gmail"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  aria-invalid={newEmailStatus === "invalid"}
                  aria-describedby={
                    newEmailStatus === "invalid" && newEmailError
                      ? "lc_new_email_error"
                      : "lc_new_email_helper"
                  }
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    if (!touchedNewEmail) setTouchedNewEmail(true);
                  }}
                  onBlur={() => setTouchedNewEmail(true)}
                  placeholder="yourname@gmail.com"
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 ${
                    newEmailStatus === "valid"
                      ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 focus:ring-emerald-500 text-slate-900 dark:text-white border"
                      : newEmailStatus === "invalid"
                      ? "border-rose-500 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500 text-slate-900 dark:text-white border"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-purple-600 text-slate-900 dark:text-white border"
                  }`}
                />
                <div className="absolute right-3 top-3 pointer-events-none flex items-center">
                  {checkingRegistered && (
                    <Loader2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin" />
                  )}
                  {!checkingRegistered && newEmailStatus === "valid" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {!checkingRegistered && newEmailStatus === "invalid" && (
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  )}
                </div>
              </div>
              {newEmailStatus === "invalid" && newEmailError ? (
                <p id="lc_new_email_error" role="alert" className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{newEmailError}</span>
                </p>
              ) : (
                <div id="lc_new_email_helper">
                  <EmailVerificationHelperText variant="inline" />
                </div>
              )}
            </div>

            {/* Field 2: Confirm New Gmail Address */}
            <div id="lc_field_group_confirm_gmail" className="space-y-1">
              <label htmlFor="lc_target_confirm_gmail" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Confirm New Gmail Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="lc_target_confirm_gmail"
                  id="lc_target_confirm_gmail"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  aria-invalid={confirmStatus === "invalid"}
                  aria-describedby={confirmStatus === "invalid" && confirmError ? "lc_confirm_email_error" : undefined}
                  value={confirmNewEmail}
                  onChange={(e) => {
                    setConfirmNewEmail(e.target.value);
                    if (!touchedConfirm) setTouchedConfirm(true);
                  }}
                  onBlur={() => setTouchedConfirm(true)}
                  placeholder="Confirm yourname@gmail.com"
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 ${
                    confirmStatus === "valid"
                      ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 focus:ring-emerald-500 text-slate-900 dark:text-white border"
                      : confirmStatus === "invalid"
                      ? "border-rose-500 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500 text-slate-900 dark:text-white border"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-purple-600 text-slate-900 dark:text-white border"
                  }`}
                />
                {confirmStatus === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 top-3 pointer-events-none" />
                )}
                {confirmStatus === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-3 top-3 pointer-events-none" />
                )}
              </div>
              {confirmStatus === "invalid" && confirmError && (
                <p id="lc_confirm_email_error" role="alert" className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{confirmError}</span>
                </p>
              )}
            </div>

            {/* Field 3: Current Password */}
            <div id="lc_field_group_current_password" className="space-y-1">
              <label htmlFor="lc_auth_current_password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="lc_auth_current_password"
                  id="lc_auth_current_password"
                  autoComplete="current-password"
                  data-lpignore="true"
                  aria-invalid={passwordStatus === "invalid"}
                  aria-describedby={passwordStatus === "invalid" && passwordError ? "lc_password_error" : undefined}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordAuthError) {
                      setPasswordAuthError(null);
                    }
                    if (!touchedPassword) setTouchedPassword(true);
                  }}
                  onBlur={() => setTouchedPassword(true)}
                  placeholder="Enter current password..."
                  className={`w-full pl-3.5 pr-20 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 ${
                    passwordStatus === "valid"
                      ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 focus:ring-emerald-500 text-slate-900 dark:text-white border"
                      : passwordStatus === "invalid"
                      ? "border-rose-500 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500 text-slate-900 dark:text-white border"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-purple-600 text-slate-900 dark:text-white border"
                  }`}
                />
                <div className="absolute right-2 top-1.5 flex items-center gap-1">
                  {passwordStatus === "valid" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {passwordStatus === "invalid" && (
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  )}
                  <button
                    type="button"
                    id="lc_toggle_password_visibility_btn"
                    onClick={() => setShowPassword(!showPassword)}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {passwordStatus === "invalid" && passwordError && (
                <p id="lc_password_error" role="alert" className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                id="lc_cancel_change_email_btn"
                disabled={sending}
                onClick={handleRequestClose}
                className="min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="lc_submit_change_email_btn"
                disabled={sending}
                className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Verification Link...</span>
                  </>
                ) : (
                  <span>Send Verification Link</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

