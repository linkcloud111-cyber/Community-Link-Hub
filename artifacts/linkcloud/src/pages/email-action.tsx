import React, { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { auth, db } from "@/lib/firebase";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { EmailChangeRequest } from "@/lib/types";
import { validatePasswordStrength } from "@/lib/utils";
import { EMAIL_CHANGE_TTL_MS } from "@/lib/auth";
import { upsertUserProfile } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";

type ActionStatus =
  | "loading"
  | "success"
  | "expired"
  | "cancelled"
  | "superseded"
  | "invalid"
  | "already_used"
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

export default function EmailActionPage() {
  const [, setLocation] = useLocation();
  const { refreshProfile, isWebmaster } = useAuth();
  const [status, setStatus] = useState<ActionStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [oobCode, setOobCode] = useState<string>("");
  const [continueUrl, setContinueUrl] = useState<string>("");

  // Verification details
  const [oldEmailDisplay, setOldEmailDisplay] = useState<string>("");
  const [newEmailDisplay, setNewEmailDisplay] = useState<string>("");

  // Password reset state
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
    const rawContinueUrl = searchParams.get("continueUrl") || "";
    const rawReqId = searchParams.get("reqId") || searchParams.get("requestId") || "";
    const rawUid = searchParams.get("uid") || "";
    const rawEmail = searchParams.get("email") || "";

    setMode(rawMode);
    setOobCode(rawOobCode);
    setContinueUrl(rawContinueUrl);

    // Diagnostic logging
    console.log("[EMAIL ACTION] mode=", rawMode);
    console.log("[EMAIL ACTION] oobCodePresent=", Boolean(rawOobCode));
    console.log("[EMAIL ACTION] continueUrl=", rawContinueUrl);
    console.log("[EMAIL ACTION] operation=", rawMode);
    console.log("[EMAIL ACTION] reqId=", rawReqId, "uid=", rawUid, "email=", rawEmail);

    // If verifyAndChangeEmail mode or custom token/reqId is provided, delegate immediately to dedicated verify-handler
    if (rawMode === "verifyAndChangeEmail" || searchParams.get("token") || (searchParams.get("reqId") && !rawOobCode)) {
      window.location.replace('/verify-handler' + window.location.search);
      return;
    }

    if (!rawOobCode) {
      console.warn("[EMAIL ACTION] No oobCode provided in URL parameters");
      setStatus("invalid");
      setErrorMessage("No verification code was found in the link. Please request a new verification link.");
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
          console.error("[EMAIL ACTION] verifyPasswordResetCode error:", err);
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
          console.log("[EMAIL ACTION] applyActionCode START (recoverEmail)");
          await applyActionCode(auth, rawOobCode);
          console.log("[EMAIL ACTION] applyActionCode SUCCESS (recoverEmail)");
          setStatus("success");
          setErrorMessage("Your email address has been successfully restored.");
        } catch (err: any) {
          console.error("[EMAIL ACTION] recoverEmail error:", err);
          setStatus("invalid");
          setErrorMessage("This email recovery link is invalid or has already been used.");
        }
        return;
      }

      // 3. Email Change (verifyAndChangeEmail) or Account Verification (verifyEmail)
      const isEmailChange = rawMode === "verifyAndChangeEmail" || rawMode === "verifyEmail";

      try {
        let activeReqDoc: EmailChangeRequest | null = null;

        // Step A: Inspect action code metadata if possible
        let actionEmail = rawEmail;
        try {
          const actionInfo = await checkActionCode(auth, rawOobCode);
          if (actionInfo?.data?.email) {
            actionEmail = actionInfo.data.email;
          }
          if (actionInfo?.data?.previousEmail) {
            setOldEmailDisplay(actionInfo.data.previousEmail);
          }
        } catch (infoErr) {
          console.warn("[EMAIL ACTION] checkActionCode inspect notice:", infoErr);
        }

        const targetUid = rawUid || auth.currentUser?.uid || "";
        let userActiveRef = targetUid ? doc(db, `users/${targetUid}/emailChanges`, "active") : null;

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
          } catch (reqErr) {
            console.warn("[EMAIL ACTION] Error loading reqId document:", reqErr);
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
          } catch (uErr) {
            console.warn("[EMAIL ACTION] Error loading user active doc:", uErr);
          }
        }

        // Check 3: ONLY IF NO rawReqId was provided in the URL, query collection by userId
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
          } catch (qErr) {
            console.warn("[EMAIL ACTION] Error querying requests by userId:", qErr);
          }
        }

        const now = Date.now();

        // Step C: Request Lifecycle Guards
        if (!activeReqDoc) {
          console.warn("[EMAIL ACTION] No matching email change request found. Aborting applyActionCode.");
          setStatus("invalid");
          setErrorMessage("This verification link is invalid or has already been used.");
          return;
        }

        console.log("[EMAIL ACTION] requestId=", activeReqDoc.requestId);
        console.log("[EMAIL ACTION] requestStatus=", activeReqDoc.status);
        console.log("[EMAIL ACTION] requestVersion=", activeReqDoc.version);
        console.log("[EMAIL ACTION] expiresAt=", activeReqDoc.expiresAt);

        setOldEmailDisplay(activeReqDoc.oldEmail || "");
        setNewEmailDisplay(activeReqDoc.newEmail || actionEmail || "");

        // 1. User ID matching check (if rawUid present)
        if (rawUid && activeReqDoc.userId && rawUid !== activeReqDoc.userId) {
          console.warn("[EMAIL ACTION] User ID mismatch. Aborting applyActionCode.");
          setStatus("invalid");
          setErrorMessage("This verification link does not belong to the active user account.");
          return;
        }

        // 2. Email matching check (if actionEmail present)
        if (actionEmail && activeReqDoc.newEmail && actionEmail.trim().toLowerCase() !== activeReqDoc.newEmail.trim().toLowerCase()) {
          console.warn("[EMAIL ACTION] Target email mismatch. Aborting applyActionCode.");
          setStatus("invalid");
          setErrorMessage("This verification link does not match the requested email address.");
          return;
        }

        // 3. Authoritative Expiration Gate (15-minute TTL)
        if (activeReqDoc.status === "expired" || now > activeReqDoc.expiresAt) {
          console.warn("[EMAIL ACTION] Request has expired (15-minute TTL elapsed). Aborting applyActionCode.");
          if (userActiveRef) {
            await setDoc(userActiveRef, { status: "EXPIRED", updatedAt: now }, { merge: true }).catch(() => {});
          }
          if (activeReqDoc.requestId) {
            await setDoc(
              doc(db, "emailChangeRequests", activeReqDoc.requestId),
              { status: "expired", updatedAt: now },
              { merge: true }
            ).catch(() => {});
          }
          setStatus("expired");
          setErrorMessage("This verification link has expired. Please return to LinkCloud and request a new verification link.");
          return;
        }

        // 4. Check if cancelled
        if (activeReqDoc.status === "cancelled") {
          console.warn("[EMAIL ACTION] Request is cancelled. Aborting applyActionCode.");
          setStatus("cancelled");
          setErrorMessage("This verification link is no longer valid.");
          return;
        }

        // 5. Check if superseded
        if (activeReqDoc.status === "superseded") {
          console.warn("[EMAIL ACTION] Request is superseded. Aborting applyActionCode.");
          setStatus("superseded");
          setErrorMessage("This verification link was superseded by a newer request. Please use your latest link.");
          return;
        }

        // 6. Check if already completed
        if (activeReqDoc.status === "completed") {
          console.warn("[EMAIL ACTION] Request already completed. Aborting applyActionCode.");
          setStatus("invalid");
          setErrorMessage("This verification link is invalid or has already been used.");
          return;
        }

        // 7. If status is already verified
        if (activeReqDoc.status === "verified") {
          setStatus("success");
          setErrorMessage("Your new email has been verified. Please return to LinkCloud and click 'Refresh Verification Status'. You can close this page.");
          return;
        }

        // Step D: Apply Action Code via Firebase Authentication
        console.log("[EMAIL ACTION] applyActionCode START");
        await applyActionCode(auth, rawOobCode);
        console.log("[EMAIL ACTION] applyActionCode SUCCESS");

        // If user is currently signed in on this client, force auth refresh
        if (auth.currentUser) {
          try {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
            console.log("[EMAIL ACTION] Auth user reloaded on client:", auth.currentUser.email);
          } catch (reloadErr) {
            console.warn("[EMAIL ACTION] Auth reload notice:", reloadErr);
          }
        }

        const targetNewEmail = activeReqDoc?.newEmail || actionEmail || "";
        const targetOldEmail = activeReqDoc?.oldEmail || "";
        const finalUid = activeReqDoc?.userId || targetUid || auth.currentUser?.uid || "";

        if (targetNewEmail) {
          setNewEmailDisplay(targetNewEmail);
        }
        if (targetOldEmail) {
          setOldEmailDisplay(targetOldEmail);
        }

        // Step E: Set request status to verified in Firestore (Do NOT overwrite primary email yet - wait for manual Refresh Status)
        if (activeReqDoc) {
          try {
            await setDoc(
              doc(db, "emailChangeRequests", activeReqDoc.requestId),
              { status: "verified", verifiedAt: Date.now(), updatedAt: Date.now() },
              { merge: true }
            );
            console.log("[EMAIL ACTION] Request marked as verified in Firestore:", activeReqDoc.requestId);
          } catch (e) {
            console.warn("[EMAIL ACTION] Error setting request verified:", e);
          }
        }

        if (finalUid) {
          try {
            await setDoc(
              doc(db, `users/${finalUid}/emailChanges`, "active"),
              { status: "VERIFIED", verifiedAt: Date.now(), updatedAt: Date.now() },
              { merge: true }
            );
          } catch (e) {
            console.warn("[EMAIL ACTION] Error setting user active email change verified:", e);
          }

          // If this was an initial account verification (not an email change request)
          if (!activeReqDoc) {
            await upsertUserProfile(finalUid, {
              emailVerified: true,
              status: "active",
            }).catch(() => {});
          }
        }

        // Step F: Auth refresh without triggering automatic Firestore email commit
        if (auth.currentUser) {
          try {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
          } catch {}
        }

        setStatus("success");
        toast.success("New email address verified successfully!");
        // NO automatic redirect: user stays on verification page as mandated by specification.
      } catch (err: any) {
        console.error("[EMAIL ACTION] applyActionCode ERROR:", err);
        const code = err?.code || "";
        const msg = String(err?.message || "");

        if (code === "auth/invalid-action-code" || msg.includes("invalid-action-code")) {
          setStatus("invalid");
          setErrorMessage("This verification link is invalid or has already been used.");
        } else if (code === "auth/expired-action-code" || msg.includes("expired-action-code")) {
          setStatus("expired");
          setErrorMessage("This verification link has expired. Please return to LinkCloud and request a new verification link.");
        } else if (code === "auth/network-request-failed" || msg.includes("network")) {
          setStatus("network_error");
          setErrorMessage("Unable to verify right now due to a network connection issue. Please check your internet and try again.");
        } else {
          setStatus("invalid");
          setErrorMessage(err?.message || "Verification failed. Please request a new verification link.");
        }
      }
    };

    processAction();
  }, [refreshProfile, isWebmaster, setLocation]);

  // Handle Password Reset Form Submission
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
      console.error("[EMAIL ACTION] confirmPasswordReset error:", err);
      toast.error(err?.message || "Failed to reset password. Please request a new link.");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div id="lc_email_action_root" className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 py-12">
      <div className="w-full max-w-lg">
        {/* 1. LOADING STATE */}
        {status === "loading" && (
          <div
            id="lc_action_loading_card"
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
                Please wait while we confirm your verification link with LinkCloud...
              </p>
            </div>
          </div>
        )}

        {/* 2. SUCCESS STATE (Terminal read-only view) */}
        {status === "success" && (
          <div
            id="lc_action_success_card"
            className="bg-card/95 backdrop-blur-xl border border-emerald-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            {/* Success Heading & Message */}
            <div className="space-y-2">
              <h2 id="lc_action_success_heading" className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
                New email address verified successfully!
              </h2>
              <p className="text-sm text-muted-foreground">
                Please return to your LinkCloud tab and click <strong>&apos;Refresh Status&apos;</strong> to complete your email change.
              </p>
            </div>

            {/* Email Details Display */}
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
                    <span className="text-muted-foreground font-medium">New Email:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {maskEmail(newEmailDisplay)}
                    </span>
                  </div>
                )}
              </div>
            )}

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
                className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <span>{auth.currentUser ? "Go to Dashboard" : "Sign In to LinkCloud"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can safely close this window or continue to your dashboard.
              </p>
            </div>
          </div>
        )}

        {/* 3. EXPIRED STATE (Strict 60-second TTL elapsed) */}
        {status === "expired" && (
          <div
            id="lc_action_expired_card"
            className="bg-card/95 backdrop-blur-xl border border-rose-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-inner">
              <XCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 id="lc_action_expired_heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                Verification Link Expired
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                This verification link has expired. LinkCloud email verification links are valid for 15 minutes.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Please return to LinkCloud and request a new verification link.
              </p>
              <p className="text-xs text-muted-foreground">
                You can close this page.
              </p>
            </div>
          </div>
        )}

        {/* 4. CANCELLED STATE */}
        {status === "cancelled" && (
          <div
            id="lc_action_cancelled_card"
            className="bg-card/95 backdrop-blur-xl border border-rose-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-inner">
              <XCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 id="lc_action_cancelled_heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                Verification Cancelled
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                This email change request was cancelled. This verification link is no longer valid.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground">
                You can close this page.
              </p>
            </div>
          </div>
        )}

        {/* 5. SUPERSEDED / REPLACED STATE */}
        {status === "superseded" && (
          <div
            id="lc_action_superseded_card"
            className="bg-card/95 backdrop-blur-xl border border-rose-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-inner">
              <XCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 id="lc_action_superseded_heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                Verification Link Replaced
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                This verification link is no longer active. Please use the latest verification link sent to your email.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground">
                You can close this page.
              </p>
            </div>
          </div>
        )}

        {/* 6. INVALID / ALREADY USED STATE */}
        {status === "invalid" && (
          <div
            id="lc_action_invalid_card"
            className="bg-card/95 backdrop-blur-xl border border-rose-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-inner">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 id="lc_action_invalid_heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                Invalid Verification Link
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {errorMessage || "This verification link is invalid, malformed, or has already been used."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
              <p className="text-xs text-muted-foreground">
                You can close this page.
              </p>
            </div>
          </div>
        )}

        {/* 7. NETWORK ERROR STATE */}
        {status === "network_error" && (
          <div
            id="lc_action_network_card"
            className="bg-card/95 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-yellow-600" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-inner">
              <AlertTriangle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 id="lc_action_network_heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                Unable to Verify Right Now
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {errorMessage || "Network connection error. Please check your internet connection and try again."}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition flex items-center justify-center gap-2"
              >
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}

        {/* 8. PASSWORD RESET FORM */}
        {status === "reset_form" && (
          <div
            id="lc_action_reset_form_card"
            className="bg-card/95 backdrop-blur-xl border border-border rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden space-y-6 animate-in fade-in duration-200"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                Set New Password
              </h2>
              <p className="text-xs text-muted-foreground">
                Resetting password for <strong className="text-foreground">{resetEmail}</strong>
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">Confirm New Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <button
                type="submit"
                disabled={resettingPassword}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Reset Password</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export { EmailActionPage };
