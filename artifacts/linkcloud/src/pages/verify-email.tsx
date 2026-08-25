import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { resendVerificationEmail, signOut, getActiveEmailChangeRequest } from "@/lib/auth";
import { upsertUserProfile } from "@/lib/firestore";
import { toast } from "sonner";
import {
  Mail,
  RefreshCw,
  LogOut,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function VerifyEmailPage() {
  const { user, isWebmaster, refreshProfile, checkAndSyncEmailChangeStatus, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Action code processing state (when opened via email link with ?oobCode=...)
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verifiedEmailInfo, setVerifiedEmailInfo] = useState<string | null>(null);
  const actionProcessedRef = useRef(false);

  // 1. Process oobCode if present in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get("oobCode");
    const mode = urlParams.get("mode");

    if (!oobCode || actionProcessedRef.current) return;
    actionProcessedRef.current = true;

    if (mode === "verifyAndChangeEmail") {
      setLocation(`/email-action${window.location.search}`);
      return;
    }

    setIsProcessingAction(true);

    const handleAction = async () => {
      try {
        // Inspect action code info if possible
        try {
          const info = await checkActionCode(auth, oobCode);
          if (info.operation === "VERIFY_AND_CHANGE_EMAIL") {
            setLocation(`/email-action${window.location.search}`);
            return;
          }
          if (info.data?.email) {
            setVerifiedEmailInfo(info.data.email);
          }
        } catch {
          // checkActionCode might fail if code is single-use, continue to apply
        }

        // Check if there is an active request in Firestore for the currentUser
        if (auth.currentUser) {
          const activeReq = await getActiveEmailChangeRequest(auth.currentUser.uid);
          const now = Date.now();
          if (activeReq) {
            if (activeReq.status === "cancelled") {
              setActionError("This verification link was cancelled.");
              setIsProcessingAction(false);
              return;
            }
            if (activeReq.status === "superseded") {
              setActionError("This is an older verification link. Please use the latest link.");
              setIsProcessingAction(false);
              return;
            }
            if (activeReq.status === "expired" || now > activeReq.expiresAt) {
              setActionError("This verification link has expired.");
              setIsProcessingAction(false);
              return;
            }
          }
        }

        // Apply action code
        try {
          await applyActionCode(auth, oobCode);
        } catch (applyErr: any) {
          // If code was already applied or invalid, check if currentUser is already verified
          if (auth.currentUser) {
            await auth.currentUser.reload().catch(() => {});
            if (auth.currentUser.emailVerified) {
              // Successfully verified already!
            } else {
              throw applyErr;
            }
          } else {
            throw applyErr;
          }
        }

        // Remove oobCode from URL to prevent double execution
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        setActionSuccess(true);
        setIsProcessingAction(false);
        toast.success("Email verified successfully.");

        // If user is currently logged in, refresh session and redirect to dashboard
        if (auth.currentUser) {
          try {
            await refreshProfile();
          } catch {
            // ignore reload transient notice
          }
          setTimeout(() => {
            setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard?tab=profile");
          }, 800);
        }
      } catch (err: any) {
        console.warn("Action code verification notice:", err);
        setIsProcessingAction(false);
        if (auth.currentUser?.emailVerified) {
          setActionSuccess(true);
          setTimeout(() => {
            setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard?tab=profile");
          }, 800);
          return;
        }
        const code = err?.code || "";
        if (code === "auth/invalid-action-code" || code === "auth/code-expired") {
          setActionError("This verification link is invalid or has expired. Please request a new verification link.");
        } else {
          setActionError(err?.message || "Failed to verify email address. Please try again.");
        }
      }
    };

    handleAction();
  }, [isWebmaster, refreshProfile, setLocation]);

  // 2. Redirect logic for standard verify-email view (when no action code is being processed)
  useEffect(() => {
    if (authLoading || isProcessingAction || actionSuccess || actionError) return;

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("oobCode")) return; // Don't redirect while oobCode is pending
    }

    if (!user) {
      setLocation("/login");
    } else if (user.emailVerified || isWebmaster) {
      setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard");
    }
  }, [user, isWebmaster, authLoading, isProcessingAction, actionSuccess, actionError, setLocation]);

  // 3. Cooldown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // 4. Handle Action Code Processing View
  if (isProcessingAction) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background py-12">
        <div className="w-full max-w-lg">
          <div className="bg-card/90 backdrop-blur-xl border border-border rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-purple-500/10 text-purple-600 mb-6 shadow-inner animate-pulse">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Verifying Email Address
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Please wait while we confirm your email verification...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 5. Handle Action Code Success View (when opened in new context or transitioning)
  if (actionSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background py-12">
        <div className="w-full max-w-lg">
          <div className="bg-card/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-6 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Email Verified Successfully!
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {verifiedEmailInfo
                ? `Your email address (${verifiedEmailInfo}) has been verified.`
                : "Your email address has been verified and updated successfully."}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (user) {
                    setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard");
                  } else {
                    setLocation("/login");
                  }
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span>{user ? "Continue to Dashboard" : "Sign In to LinkCloud"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. Handle Action Code Error View
  if (actionError) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background py-12">
        <div className="w-full max-w-lg">
          <div className="bg-card/90 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-red-500" />
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-rose-500/10 text-rose-500 mb-6 shadow-inner">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-rose-600 dark:text-rose-400">
              Verification Failed
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {actionError}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (user) {
                    setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard");
                  } else {
                    setLocation("/login");
                  }
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span>{user ? "Return to Dashboard" : "Back to Login"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle Resend Verification Email
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendVerificationEmail(user);
      setCooldown(60);
      toast.success(`Verification email sent to ${user.email}! Please check your inbox and spam folder.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send verification email. Please try again later.");
    } finally {
      setResending(false);
    }
  };

  // Handle Refresh Verification Status
  const handleRefreshStatus = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await checkAndSyncEmailChangeStatus({
        manual: true,
        caller: "VerifyEmailPage.handleRefreshStatus",
      });
      if (result.status === "success") {
        setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard?tab=profile");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to check verification status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully.");
      setLocation("/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to logout.");
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background py-12">
      <div className="w-full max-w-lg">
        <div className="bg-card/90 backdrop-blur-xl border border-border rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-500 mb-6 shadow-inner relative">
            <Mail className="w-10 h-10" />
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
              !
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Verify Your Email Address
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            We sent a verification link to activate your account.
          </p>

          {/* Check Your Inbox Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-left mb-8 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Check your inbox</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A verification email was sent to{" "}
              <strong className="text-foreground font-semibold break-all">
                {user.email}
              </strong>
              . Open the email and click the verification link to unlock full access to LinkCloud.
            </p>
            <p className="text-[11px] text-muted-foreground/80 italic pt-1">
              Didn't find it? Make sure to check your spam or junk folder.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleRefreshStatus}
              disabled={checking}
              className="w-full py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking Status...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Refresh Verification Status
                </>
              )}
            </button>

            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full py-3.5 px-6 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-secondary/80 transition border border-border flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending Email...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Send className="w-4 h-4" /> Resend in {cooldown}s
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Resend Verification Email
                </>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3 px-6 rounded-xl bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium text-xs transition flex items-center justify-center gap-2 pt-3"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout & Sign in with another account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
