import React, { useState, useEffect, useRef } from 'react';
import { handleUpdateEmailSecure, verifyAndCompleteFlow, resendVerificationEmailSecure, handleFinalVerificationCheck } from '@/lib/auth';
import { useLocation } from 'wouter';
import { Mail, CheckCircle2, Check, Clock, ArrowRight, Loader2, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function EmailVerificationScreen() {
  const [, setLocation] = useLocation();
  const [newEmail, setNewEmail] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes countdown
  const [resendCooldown, setResendCooldown] = useState(0); // 30 seconds resend cooldown
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  // Focus management refs
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const verifyButtonRef = useRef<HTMLButtonElement | null>(null);
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // Check initial state from localStorage if active flow exists
  useEffect(() => {
    try {
      const expiresAt = localStorage.getItem("email_verify_expires");
      if (expiresAt) {
        const remaining = Math.floor((parseInt(expiresAt, 10) - Date.now()) / 1000);
        if (remaining > 0) {
          setTimeLeft(remaining);
          setIsPending(true);
        } else {
          localStorage.removeItem("email_verify_expires");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Manage focus transitions
  useEffect(() => {
    if (isSuccess) {
      successHeadingRef.current?.focus();
    } else if (isPending) {
      verifyButtonRef.current?.focus();
    } else {
      emailInputRef.current?.focus();
    }
  }, [isPending, isSuccess]);

  // Timer countdown logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPending && !isSuccess && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPending, isSuccess, timeLeft]);

  // Resend cooldown timer logic
  useEffect(() => {
    let cooldownTimer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(cooldownTimer);
  }, [resendCooldown]);

  const onSubmitEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setLoading(true);
    try {
      await handleUpdateEmailSecure(newEmail.trim());
      setIsPending(true);
      setTimeLeft(900);
      setResendCooldown(30); // 30s initial cooldown
      toast.success("Verification email sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update email.");
      emailInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const onResendEmail = async () => {
    if (resending || resendCooldown > 0 || isSuccess) return;
    setResending(true);
    try {
      await resendVerificationEmailSecure();
      setTimeLeft(900);
      setResendCooldown(30); // 30-second cooldown to prevent spamming
      toast.success("A fresh verification email has been sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  const onCheckStatus = async () => {
    if (checking || isSuccess) return;
    setChecking(true);
    try {
      const result = await verifyAndCompleteFlow();
      if (result.status) {
        setIsSuccess(true);
        toast.success("Email verified successfully! Redirecting to dashboard...", {
          description: "Your email address has been confirmed.",
        });
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/dashboard?tab=profile";
          } else {
            setLocation("/dashboard?tab=profile");
          }
        }, 1000);
      } else {
        if (result.expired) {
          toast.error("Session Expired. Please request a new link.");
          setIsPending(false);
          localStorage.removeItem("email_verify_expires");
        } else {
          toast.info(result.message || "Email is not verified yet. Please check your inbox.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div id="email-verification-container" className="min-h-[500px] flex items-center justify-center p-4">
      <div 
        id="email-verification-card"
        role="region"
        aria-labelledby="email-verification-heading"
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-6 sm:p-8 overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success-screen"
              id="verification-success-screen"
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="py-8 text-center flex flex-col items-center justify-center space-y-5 focus:outline-none"
            >
              {/* Centered scaling green checkmark animation */}
              <div className="relative flex items-center justify-center my-2" aria-hidden="true">
                {/* Pulsing ring animation */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: [0.6, 1.5, 1.8], opacity: [0.8, 0.3, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-24 h-24 rounded-full bg-emerald-500/20"
                />

                {/* Scaling green checkmark circle badge */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.25, 1], opacity: 1 }}
                  transition={{
                    duration: 0.5,
                    times: [0, 0.7, 1],
                    ease: "easeOut"
                  }}
                  className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 border-4 border-background"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -30, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{
                      delay: 0.18,
                      type: "spring",
                      stiffness: 300,
                      damping: 18
                    }}
                  >
                    <Check className="w-10 h-10 stroke-[3.5]" />
                  </motion.div>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="space-y-1.5"
              >
                <h2 
                  ref={successHeadingRef}
                  id="email-verification-heading" 
                  tabIndex={-1} 
                  className="text-2xl font-bold text-foreground focus:outline-none"
                >
                  Email Verified!
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Your address has been confirmed. Redirecting to your dashboard...
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-2 pt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                aria-live="polite"
              >
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> 
                <span>Redirecting securely...</span>
              </motion.div>
            </motion.div>
          ) : !isPending ? (
            <motion.form
              key="change-form"
              id="change-email-form"
              aria-labelledby="email-verification-heading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              onSubmit={onSubmitEmailChange}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary" aria-hidden="true">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="email-verification-heading" className="text-xl font-bold text-foreground">Change Email Address</h2>
                  <p id="email-input-description" className="text-xs text-muted-foreground">
                    Enter your new email to receive a verification link
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="new-email-input" className="text-xs font-semibold text-foreground">
                  New Email Address
                </label>
                <input 
                  ref={emailInputRef}
                  id="new-email-input"
                  name="email"
                  type="email" 
                  autoComplete="email"
                  placeholder="e.g. name@example.com" 
                  value={newEmail} 
                  onChange={(e) => setNewEmail(e.target.value)}
                  aria-required="true"
                  aria-describedby="email-input-description"
                  aria-label="New Email Address"
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
                  required
                />
              </div>

              <button 
                id="send-verification-button"
                type="submit" 
                disabled={loading}
                aria-busy={loading}
                aria-label={loading ? "Sending verification email..." : "Send Verification Link"}
                className="relative overflow-hidden w-full bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-lg hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-80 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {loading && (
                  <div className="absolute inset-0 bg-primary/90 backdrop-blur-[1px] flex items-center justify-center gap-2 text-primary-foreground z-10">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span className="text-sm font-medium animate-pulse">Sending verification link...</span>
                  </div>
                )}
                <span className={loading ? "opacity-0" : "flex items-center gap-2"}>
                  <span>Send Verification Link</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="verification-pending"
              id="verification-pending-view"
              aria-labelledby="email-verification-heading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2" aria-hidden="true">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <h2 id="email-verification-heading" className="text-xl font-bold text-foreground">Verify Your Email</h2>
                <p id="verification-instructions" className="text-sm text-muted-foreground mt-1">
                  We have sent a verification link to <b className="text-foreground">{newEmail}</b>.
                </p>
                <div 
                  id="verification-countdown"
                  role="timer"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`Link expires in ${Math.floor(timeLeft / 60)} minutes and ${timeLeft % 60} seconds`}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium"
                >
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    Link expires in: <span className="font-bold">{Math.floor(timeLeft / 60)}:{timeLeft % 60 < 10 ? '0' : ''}{timeLeft % 60}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button 
                  ref={verifyButtonRef}
                  id="check-verification-button"
                  type="button"
                  onClick={onCheckStatus} 
                  disabled={checking}
                  aria-busy={checking}
                  aria-label={checking ? "Verifying email status..." : "I Have Verified, Continue to Dashboard"}
                  aria-describedby="verification-instructions"
                  className="relative overflow-hidden w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-90 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  {checking && (
                    <div className="absolute inset-0 bg-emerald-700/95 backdrop-blur-[1px] flex items-center justify-center gap-2 text-white z-10">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span className="text-sm font-medium animate-pulse">Checking status...</span>
                    </div>
                  )}
                  <span className={checking ? "opacity-0" : "flex items-center gap-2"}>
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> 
                    <span>I Have Verified (Continue)</span>
                  </span>
                </button>

                {/* Resend Verification Email with Cooldown */}
                <button
                  id="resend-verification-button"
                  type="button"
                  onClick={onResendEmail}
                  disabled={resending || resendCooldown > 0}
                  aria-busy={resending}
                  aria-disabled={resending || resendCooldown > 0}
                  aria-label={
                    resending 
                      ? "Sending a fresh verification email..." 
                      : resendCooldown > 0 
                        ? `Resend available in ${resendCooldown} seconds` 
                        : "Resend Verification Email"
                  }
                  className="relative overflow-hidden w-full bg-secondary/80 hover:bg-secondary text-secondary-foreground font-medium py-2 px-4 rounded-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs border border-border/60 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {resending && (
                    <div className="absolute inset-0 bg-secondary/95 backdrop-blur-[1px] flex items-center justify-center gap-2 text-secondary-foreground z-10">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      <span className="animate-pulse">Sending fresh link...</span>
                    </div>
                  )}
                  <span className={resending ? "opacity-0" : "flex items-center gap-2"}>
                    {resendCooldown > 0 ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> 
                        <span>Resend available in {resendCooldown}s</span>
                      </>
                    ) : (
                      <>
                        <RotateCw className="w-3.5 h-3.5" aria-hidden="true" /> 
                        <span>Resend Verification Email</span>
                      </>
                    )}
                  </span>
                </button>
                
                <button 
                  id="cancel-email-change-button"
                  type="button"
                  onClick={() => {
                    setIsPending(false);
                    localStorage.removeItem("email_verify_expires");
                  }} 
                  aria-label="Cancel and change email address"
                  className="text-xs text-rose-500 hover:text-rose-600 hover:underline py-1 w-full text-center transition-colors block focus:outline-none focus:ring-2 focus:ring-rose-500 rounded"
                >
                  Cancel / Change Email
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
