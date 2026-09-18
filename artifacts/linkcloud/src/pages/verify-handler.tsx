import React, { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { auth, db } from "@/lib/firebase";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
  signInWithCustomToken,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { EmailChangeRequest } from "@/lib/types";
import { validatePasswordStrength } from "@/lib/utils";
import { EMAIL_CHANGE_TTL_MS } from "@/lib/auth";
import { upsertUserProfile } from "@/lib/firestore";

type HandlerStatus =
  | "loading"
  | "success"
  | "expired"
  | "cancelled"
  | "superseded"
  | "invalid"
  | "network_error"
  | "reset_form";

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  const start = local.slice(0, 2);
  const end = local.slice(-1);
  return `${start}***${end}@${domain}`;
}

export default function VerifyHandlerPage() {
  const [, setLocation] = useLocation();
  const { refreshProfile, isWebmaster, startSessionHandoff, endSessionHandoff } = useAuth();

  const [status, setStatus] = useState<HandlerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [oobCode, setOobCode] = useState<string>("");
  const [oldEmailDisplay, setOldEmailDisplay] = useState<string>("");
  const [newEmailDisplay, setNewEmailDisplay] = useState<string>("");

  // Password reset states
  const [resetEmail, setResetEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current || typeof window === "undefined") return;
    processedRef.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const rawMode = searchParams.get("mode") || "";
    const rawOobCode = searchParams.get("oobCode") || "";
    const rawToken = searchParams.get("token") || "";
    const rawReqId = searchParams.get("reqId") || searchParams.get("requestId") || "";
    const rawUid = searchParams.get("uid") || "";
    const rawEmail = searchParams.get("email") || "";

    setMode(rawMode);
    setOobCode(rawOobCode || rawToken);

    console.log("[VERIFY HANDLER] Initialized:", {
      mode: rawMode,
      oobCodePresent: Boolean(rawOobCode),
      tokenPresent: Boolean(rawToken),
      reqId: rawReqId,
      uid: rawUid,
      currentUser: auth.currentUser?.uid || null,
    });

    if (!rawOobCode && !rawToken && rawMode !== "verifyAndChangeEmail") {
      console.warn("[VERIFY HANDLER] No verification code/token in query parameters");
      setStatus("invalid");
      setErrorMessage("No verification code was provided. Please use the link sent to your email.");
      return;
    }

    const processAction = async () => {
      // 1. Password Reset Mode
      if (rawMode === "resetPassword") {
        try {
          const email = await verifyPasswordResetCode(auth, rawOobCode);
          setResetEmail(email);
          setStatus("reset_form");
        } catch (err: any) {
          console.error("[VERIFY HANDLER] verifyPasswordResetCode error:", err);
          const code = err?.code || "";
          if (code === "auth/expired-action-code") {
            setStatus("expired");
            setErrorMessage("This password reset link has expired. Please request a new password reset link.");
          } else {
            setStatus("invalid");
            setErrorMessage("This password reset link is invalid or has already been used.");
          }
        }
        return;
      }

      // 2. Email Recovery Mode (Rollback)
      if (rawMode === "recoverEmail") {
        try {
          await applyActionCode(auth, rawOobCode);
          setStatus("success");
          setErrorMessage("Your previous email address has been successfully restored.");
          toast.success("Email address restored successfully.");
        } catch (err: any) {
          console.error("[VERIFY HANDLER] recoverEmail error:", err);
          setStatus("invalid");
          setErrorMessage("This email recovery link is invalid or has already been used.");
        }
        return;
      }

      // 3. Signup Email Verification Mode (verifyEmail) - Pure Firebase Native Flow
      if (rawMode === "verifyEmail") {
        try {
          console.log("[VERIFY HANDLER] Executing applyActionCode for native signup verification...");
          await applyActionCode(auth, rawOobCode);
          console.log("[VERIFY HANDLER] applyActionCode successful for signup verification!");

          if (auth.currentUser) {
            await upsertUserProfile(auth.currentUser.uid, {
              emailVerified: true,
              status: "active",
            }).catch(() => {});
            await refreshProfile();
          }

          setStatus("success");
          toast.success("Email address verified successfully!");
        } catch (err: any) {
          console.error("[VERIFY HANDLER] Signup verification error:", err);
          const code = err?.code || "";
          if (code === "auth/expired-action-code") {
            setStatus("expired");
            setErrorMessage("This verification link has expired. Please request a new verification link.");
          } else if (auth.currentUser?.emailVerified) {
            setStatus("success");
            toast.success("Email address verified successfully!");
          } else {
            setStatus("invalid");
            setErrorMessage("This verification link is invalid or has already been used.");
          }
        }
        return;
      }

      // 4. Custom Email Change Mode (verifyAndChangeEmail) - LinkCloud Flow
      try {
        let activeReqDoc: EmailChangeRequest | null = null;
        let actionEmail = rawEmail;

        // Step A: Inspect action code metadata if available
        try {
          const actionInfo = await checkActionCode(auth, rawOobCode);
          if (actionInfo?.data?.email) {
            actionEmail = actionInfo.data.email;
          }
          if (actionInfo?.data?.previousEmail) {
            setOldEmailDisplay(actionInfo.data.previousEmail);
          }
        } catch (inspectErr) {
          console.warn("[VERIFY HANDLER] checkActionCode inspect notice:", inspectErr);
        }

        const targetUid = rawUid || auth.currentUser?.uid || "";
        const userActiveRef = targetUid ? doc(db, `users/${targetUid}/emailChanges`, "active") : null;

        // Step B: Look up Firestore email change request records
        // Authoritative Check 1: If verification URL includes rawReqId, resolve emailChangeRequests/${rawReqId} FIRST!
        if (rawReqId) {
          try {
            const reqSnap = await getDoc(doc(db, "emailChangeRequests", rawReqId));
            if (reqSnap.exists()) {
              activeReqDoc = {
                requestId: reqSnap.id,
                ...reqSnap.data(),
              } as EmailChangeRequest;
            }
          } catch (e) {
            console.warn("[VERIFY HANDLER] Error loading reqId doc:", e);
          }
        }

        // Check 2: ONLY IF NO rawReqId was provided in the URL, inspect user active change document
        if (!rawReqId && !activeReqDoc && userActiveRef) {
          try {
            const userActiveSnap = await getDoc(userActiveRef);
            if (userActiveSnap.exists()) {
              const uData = userActiveSnap.data();
              const rawUStatus = String(uData.status || "").toLowerCase();
              activeReqDoc = {
                requestId: uData.requestId || `req_${targetUid}`,
                userId: targetUid,
                oldEmail: uData.oldEmail || "",
                newEmail: uData.targetEmail || uData.newEmail || "",
                status: (rawUStatus === "verified"
                  ? "verified"
                  : rawUStatus === "cancelled"
                  ? "cancelled"
                  : rawUStatus === "superseded"
                  ? "superseded"
                  : rawUStatus === "expired"
                  ? "expired"
                  : "pending") as any,
                createdAt: uData.createdAt || Date.now(),
                expiresAt: uData.expiresAt || (Date.now() + EMAIL_CHANGE_TTL_MS),
                version: uData.version || 1,
                updatedAt: uData.updatedAt || Date.now(),
              };
            }
          } catch (e) {
            console.warn("[VERIFY HANDLER] Error fetching user active change doc:", e);
          }
        }

        // Check 3: ONLY IF NO rawReqId was provided in the URL, query user requests by userId
        if (!rawReqId && !activeReqDoc && targetUid) {
          try {
            const q = query(
              collection(db, "emailChangeRequests"),
              where("userId", "==", targetUid)
            );
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const sorted = qSnap.docs
                .map((d) => ({ requestId: d.id, ...d.data() } as EmailChangeRequest))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              activeReqDoc = sorted[0];
            }
          } catch (e) {
            console.warn("[VERIFY HANDLER] Error loading user requests:", e);
          }
        }

        const now = Date.now();

        // Step C: Request Lifecycle Guards
        if (!activeReqDoc) {
          console.warn("[VERIFY HANDLER] No matching email change request found.");
          setStatus("invalid");
          setErrorMessage("This verification link is invalid or has already been used.");
          return;
        }

        setOldEmailDisplay(activeReqDoc.oldEmail || "");
        setNewEmailDisplay(activeReqDoc.newEmail || actionEmail || "");

        // 1. User ID matching check (if rawUid present)
        if (rawUid && activeReqDoc.userId && rawUid !== activeReqDoc.userId) {
          console.warn("[VERIFY HANDLER] User ID mismatch.");
          setStatus("invalid");
          setErrorMessage("This verification link does not belong to the active user account.");
          return;
        }

        // 2. Email matching check (if actionEmail present)
        if (actionEmail && activeReqDoc.newEmail && actionEmail.trim().toLowerCase() !== activeReqDoc.newEmail.trim().toLowerCase()) {
          console.warn("[VERIFY HANDLER] Email mismatch.");
          setStatus("invalid");
          setErrorMessage("This verification link does not match the requested email address.");
          return;
        }

        // 3. Expiration check (15-minute TTL)
        if (activeReqDoc.status === "expired" || now > activeReqDoc.expiresAt) {
          console.warn("[VERIFY HANDLER] Request expired.");
          setStatus("expired");
          setErrorMessage("This verification link has expired. Please return to LinkCloud and request a new one.");
          return;
        }

        // 4. Cancellation check
        if (activeReqDoc.status === "cancelled") {
          console.warn("[VERIFY HANDLER] Request cancelled.");
          setStatus("cancelled");
          setErrorMessage("This verification link is no longer valid.");
          return;
        }

        // 5. Superseded check
        if (activeReqDoc.status === "superseded") {
          console.warn("[VERIFY HANDLER] Request superseded.");
          setStatus("superseded");
          setErrorMessage("This verification link was superseded by a newer request. Please use your latest link.");
          return;
        }

        // 6. Completed check - check if already completed
        if (activeReqDoc.status === "completed") {
          console.log("[VERIFY HANDLER] Request already completed on server.");
        }

        const finalUid = activeReqDoc?.userId || targetUid || auth.currentUser?.uid || "";
        const targetNewEmail = activeReqDoc?.newEmail || actionEmail || "";
        const targetOldEmail = activeReqDoc?.oldEmail || "";

        if (targetNewEmail) setNewEmailDisplay(targetNewEmail);
        if (targetOldEmail) setOldEmailDisplay(targetOldEmail);

        // Step D: Execute Verification via /api/email-change/verify
        console.log("[VERIFY HANDLER] Calling /api/email-change/verify...");
        const res = await fetch("/api/email-change/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reqId: rawReqId || activeReqDoc?.requestId,
            token: rawToken || rawOobCode,
            uid: finalUid,
          }),
        });

        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          console.warn("[VERIFY HANDLER] Server API returned error:", res.status, errData);
          if (errData?.details?.code === "expired" || res.status === 410) {
            setStatus("expired");
            setErrorMessage(errData.error || "This verification link has expired.");
            return;
          }
          if (errData?.details?.code === "cancelled") {
            setStatus("cancelled");
            setErrorMessage("This verification link is no longer valid.");
            return;
          }
          if (errData?.details?.code === "superseded") {
            setStatus("superseded");
            setErrorMessage("This verification link was superseded by a newer request.");
            return;
          }
          setStatus("invalid");
          setErrorMessage(errData?.error || "This verification link is invalid or has already been used.");
          return;
        }

        const data: any = await res.json();
        console.log("[VERIFY HANDLER] Server verification response received:", {
          success: data?.success,
          newEmail: data?.newEmail,
          hasCustomToken: Boolean(data?.customToken),
        });

        if (data?.newEmail) {
          setNewEmailDisplay(data.newEmail);
        }

        // Step E: Clean up local pending tracking
        if (typeof window !== "undefined" && window.localStorage && finalUid) {
          try {
            window.localStorage.removeItem(`pending_email_${finalUid}`);
            window.localStorage.removeItem(`pending_email_req_${finalUid}`);
            window.localStorage.removeItem(`pending_email_expires_${finalUid}`);
            window.localStorage.removeItem(`resend_email_change_${finalUid}`);
          } catch {}
        }

        // Step F: Recover / Re-establish fresh Firebase authenticated session via Custom Token
        // CRITICAL: DO NOT call auth.currentUser.reload() or getIdToken(true).
        // Use signInWithCustomToken to seamlessly transition the browser session!
        if (data?.customToken) {
          try {
            startSessionHandoff();
            console.log("[VERIFY HANDLER] Signing in with fresh Firebase Custom Token...");
            await signInWithCustomToken(auth, data.customToken);
            console.log("[VERIFY HANDLER] Custom token sign-in succeeded! Active user:", auth.currentUser?.email);
            await refreshProfile();
          } catch (custErr) {
            console.error("[VERIFY HANDLER] Custom token authentication error:", custErr);
          } finally {
            endSessionHandoff();
          }
        }

        setStatus("success");
        toast.success("Email address updated successfully!");
      } catch (err: any) {
        console.error("[VERIFY HANDLER] Verification error:", err);
        const code = err?.code || "";
        const msg = String(err?.message || "");

        if (code === "auth/invalid-action-code" || msg.includes("invalid-action-code")) {
          // If already verified or active
          if (auth.currentUser?.emailVerified) {
            setStatus("success");
            toast.success("Email verified successfully!");
            return;
          }
          setStatus("invalid");
          setErrorMessage("This verification link is invalid or has already been used.");
        } else if (code === "auth/expired-action-code" || msg.includes("expired-action-code")) {
          setStatus("expired");
          setErrorMessage("This verification link has expired. Please request a new verification link.");
        } else if (code === "auth/network-request-failed" || msg.includes("network")) {
          setStatus("network_error");
          setErrorMessage("Unable to verify due to a network connection issue. Please check your connection and try again.");
        } else {
          setStatus("invalid");
          setErrorMessage(err?.message || "Verification failed. Please request a new verification link.");
        }
      }
    };

    processAction();
  }, [refreshProfile, isWebmaster, setLocation]);

  // Handle Password Reset Form Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passCheck = validatePasswordStrength(newPassword);
    if (!passCheck.valid) {
      toast.error(passCheck.error || "Please enter a strong password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setResettingPassword(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      toast.success("Password has been reset successfully.");
      setStatus("success");
      setErrorMessage("Your password has been reset successfully. You can now log in with your new password.");
    } catch (err: any) {
      console.error("[VERIFY HANDLER] confirmPasswordReset error:", err);
      toast.error(err?.message || "Failed to reset password. Please request a new link.");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div id="lc_verify_handler_root" className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 py-12">
      <div className="w-full max-w-lg">
        {/* 1. LOADING STATE */}
        {status === "loading" && (
          <div
            id="lc_handler_loading_card"
            className="bg-card/95 backdrop-blur-xl border border-border rounded-3xl p-8 sm:p-10 shadow-xl text-center space-y-5 animate-in fade-in duration-200"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                Verifying Email Change
              </h2>
              <p className="text-sm text-muted-foreground">
                Confirming your verification link and updating your profile...
              </p>
            </div>
          </div>
        )}

        {/* 2. SUCCESS STATE */}
        {status === "success" && (
          <div
            id="lc_handler_success_card"
            className="bg-card/95 backdrop-blur-xl border border-emerald-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 id="lc_handler_success_heading" className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
                Email address updated successfully!
              </h2>
              <p className="text-sm text-muted-foreground">
                Your LinkCloud account email has been updated. You can now use your new email to sign in.
              </p>
            </div>

            {(oldEmailDisplay || newEmailDisplay) && (
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2 text-left text-xs">
                {oldEmailDisplay && (
                  <div className="flex items-center justify-between py-0.5 border-b border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-muted-foreground font-medium">Previous Email:</span>
                    <span className="font-mono font-semibold text-foreground">{maskEmail(oldEmailDisplay)}</span>
                  </div>
                )}
                {newEmailDisplay && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground font-medium">Updated Primary Email:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {maskEmail(newEmailDisplay)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 space-y-3">
              {auth.currentUser ? (
                <button
                  type="button"
                  id="lc_handler_return_btn"
                  onClick={() => {
                    setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard?tab=profile");
                  }}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Return to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  id="lc_handler_return_btn"
                  onClick={() => {
                    setLocation(`/login?email=${encodeURIComponent(newEmailDisplay || "")}`);
                  }}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Sign In with New Email</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can safely close this browser window or continue to LinkCloud.
              </p>
            </div>
          </div>
        )}

        {/* 3. EXPIRED STATE */}
        {status === "expired" && (
          <div
            id="lc_handler_expired_card"
            className="bg-card/95 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Link Expired</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {errorMessage || "This verification link has expired. Please return to LinkCloud and request a new verification email."}
              </p>
            </div>
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={() => setLocation("/dashboard?tab=profile")}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span>Return to Profile Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 4. CANCELLED STATE */}
        {status === "cancelled" && (
          <div
            id="lc_handler_cancelled_card"
            className="bg-card/95 backdrop-blur-xl border border-border rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in duration-200"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
              <XCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Request Cancelled</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {errorMessage || "This email change request was cancelled."}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setLocation("/dashboard?tab=profile")}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5. SUPERSEDED STATE */}
        {status === "superseded" && (
          <div
            id="lc_handler_superseded_card"
            className="bg-card/95 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in duration-200"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Link Replaced</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {errorMessage || "A newer verification email was dispatched. Please check your inbox for the latest link."}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setLocation("/dashboard?tab=profile")}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span>Return to Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 6. INVALID / NETWORK ERROR STATE */}
        {(status === "invalid" || status === "network_error") && (
          <div
            id="lc_handler_invalid_card"
            className="bg-card/95 backdrop-blur-xl border border-destructive/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in duration-200"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive">
              <XCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                {status === "network_error" ? "Connection Issue" : "Invalid Link"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {errorMessage || "This verification link is invalid or has already been used."}
              </p>
            </div>
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={() => {
                  if (auth.currentUser) {
                    setLocation("/dashboard?tab=profile");
                  } else {
                    setLocation("/login");
                  }
                }}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span>{auth.currentUser ? "Go to Dashboard" : "Return to Login"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 7. RESET PASSWORD FORM */}
        {status === "reset_form" && (
          <div
            id="lc_handler_reset_form_card"
            className="bg-card/95 backdrop-blur-xl border border-border rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 animate-in fade-in duration-200"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-1">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Reset Your Password</h2>
              <p className="text-sm text-muted-foreground">
                Enter your new password for <span className="font-semibold text-foreground">{resetEmail}</span>
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <button
                type="submit"
                disabled={resettingPassword}
                className="w-full py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Set New Password</span>
                    <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
