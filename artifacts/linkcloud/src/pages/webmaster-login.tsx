import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  loginWebmaster,
  loginWebmasterWithMobileOTP,
  verifyWebmasterOTP,
  loginWebmasterWithMobilePassword,
  signInWebmasterGoogle,
  sendPasswordResetLink,
  logout,
  type ConfirmationResult,
} from "@/lib/auth";
import { validateIndianMobile, validateGmailAddress } from "@/lib/utils";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  KeyRound,
  Copy,
  RotateCcw,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";

type LoginMethod = "email" | "mobile";
type MobileAuthMode = "otp" | "password";

export default function WebmasterLogin() {
  const [, setLocation] = useLocation();
  const { user, isWebmaster, loading: authLoading, refreshProfile } = useAuth();

  // Active Method: Email or Mobile
  const [method, setMethod] = useState<LoginMethod>("email");

  // Email form state
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Mobile form state
  const [mobileAuthMode, setMobileAuthMode] = useState<MobileAuthMode>("otp");
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobilePassword, setMobilePassword] = useState("");
  const [showMobilePassword, setShowMobilePassword] = useState(false);

  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Status & Error
  const [status, setStatus] = useState<"idle" | "authenticating" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Redirect if already logged in as authorized Webmaster, or clear unauthorized user session
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      if (isWebmaster) {
        setLocation("/webmaster/dashboard");
      } else {
        setErrorMsg("This account is not authorized to access the Webmaster Portal.");
        logout();
      }
    }
  }, [user, isWebmaster, authLoading, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-purple-50/30 to-slate-100 dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-900 space-y-3">
        <Loader2 className="w-9 h-9 text-purple-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-600 dark:text-muted-foreground">
          Verifying Webmaster Security Credentials...
        </p>
      </div>
    );
  }

  // Clear errors when switching methods
  const handleMethodSwitch = (newMethod: LoginMethod) => {
    setMethod(newMethod);
    setErrorMsg("");
  };

  // ─── 1. Email + Password Submit ─────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg("Please enter your Webmaster email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!emailPassword) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setStatus("authenticating");

    try {
      await loginWebmaster(cleanEmail, emailPassword);
      await refreshProfile();
      setStatus("success");
      toast.success("Login successful. Opening Webmaster Dashboard...");
      setTimeout(() => {
        setLocation("/webmaster/dashboard");
      }, 600);
    } catch (err: any) {
      setStatus("idle");
      const message = err?.message || "Invalid Webmaster credentials.";
      setErrorMsg(message);
    }
  };

  // ─── 2. Mobile: Send OTP ───────────────────────────────────────────────────
  const handleSendMobileOTP = async () => {
    setErrorMsg("");
    const cleanDigits = mobileNumber.replace(/\D/g, "");

    const check = validateIndianMobile(cleanDigits);
    if (!check.valid) {
      setErrorMsg(check.error || "Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setStatus("authenticating");

    try {
      const res = await loginWebmasterWithMobileOTP(
        cleanDigits,
        "webmaster-recaptcha-container"
      );
      setConfirmationResult(res);
      setOtpSent(true);
      setResendTimer(30);
      setStatus("idle");
      toast.success(`Verification code sent to +91 ${cleanDigits.slice(-10)}`);
    } catch (err: any) {
      setStatus("idle");
      const message = err?.message || "Failed to send verification code. Please try again.";
      setErrorMsg(message);
    }
  };

  // ─── 3. Mobile: Verify OTP ─────────────────────────────────────────────────
  const handleVerifyMobileOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) {
      setErrorMsg("Session expired. Please request a new verification code.");
      return;
    }

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    setStatus("authenticating");
    setErrorMsg("");

    try {
      await verifyWebmasterOTP(confirmationResult, cleanCode);
      await refreshProfile();
      setStatus("success");
      toast.success("Verification successful. Opening Webmaster Dashboard...");
      setTimeout(() => {
        setLocation("/webmaster/dashboard");
      }, 600);
    } catch (err: any) {
      setStatus("idle");
      const message = err?.message || "Invalid verification code.";
      setErrorMsg(message);
    }
  };

  // ─── 4. Mobile: Password Submit ────────────────────────────────────────────
  const handleMobilePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanDigits = mobileNumber.replace(/\D/g, "");
    const check = validateIndianMobile(cleanDigits);
    if (!check.valid) {
      setErrorMsg(check.error || "Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!mobilePassword) {
      setErrorMsg("Please enter your Webmaster password.");
      return;
    }

    setStatus("authenticating");

    try {
      await loginWebmasterWithMobilePassword(cleanDigits, mobilePassword);
      await refreshProfile();
      setStatus("success");
      toast.success("Login successful. Opening Webmaster Dashboard...");
      setTimeout(() => {
        setLocation("/webmaster/dashboard");
      }, 600);
    } catch (err: any) {
      setStatus("idle");
      const message = err?.message || "Invalid credentials or unauthorized mobile number.";
      setErrorMsg(message);
    }
  };

  // ─── 5. Google Sign In ─────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setStatus("authenticating");

    try {
      await signInWebmasterGoogle();
      await refreshProfile();
      setStatus("success");
      toast.success("Login successful. Opening Webmaster Dashboard...");
      setTimeout(() => {
        setLocation("/webmaster/dashboard");
      }, 600);
    } catch (err: any) {
      setStatus("idle");
      const message = err?.message || "Google sign-in failed. Please try again.";
      setErrorMsg(message);
    }
  };

  // ─── 6. Forgot Password ────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your Webmaster email address first.");
      setErrorMsg("Please enter your Webmaster email address above to receive a password reset link.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    try {
      await sendPasswordResetLink(cleanEmail);
      toast.success("Password reset email sent. Please check your inbox.");
      setErrorMsg("");
    } catch (err: any) {
      const message = err?.message || "Failed to send reset email.";
      toast.error(message);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center py-8 sm:py-12 px-4 sm:px-6 bg-gradient-to-b from-slate-50 via-purple-50/30 to-slate-100/90 dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-900 selection:bg-purple-500/20 selection:text-purple-600 font-sans relative overflow-x-hidden">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/10 via-indigo-500/5 to-transparent rounded-full blur-[140px] opacity-70" />
      </div>

      <div className="w-full max-w-[500px] sm:max-w-[540px] mx-auto space-y-6 relative z-10 my-auto">
        {/* Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <Cloud className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              LinkCloud
            </span>
          </div>

          <div className="flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-100/80 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 text-xs font-bold shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Secure Webmaster Portal</span>
            </span>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-white dark:bg-card border border-purple-100/80 dark:border-border/80 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-950/5 dark:shadow-black/40 space-y-5 sm:space-y-6">
          {/* Card Title & Icon */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-foreground">
              Webmaster Login
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Secure authentication for the LinkCloud Webmaster identity.
            </p>
          </div>

          {/* Authorization Badge */}
          <div className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 text-xs font-bold text-center">
            <ShieldCheck className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>Authorized Webmaster Access Only</span>
          </div>

          {/* Method Segmented Switcher (Email vs Mobile) */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-muted/50 rounded-xl border border-slate-200 dark:border-border">
            <button
              type="button"
              onClick={() => handleMethodSwitch("email")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                method === "email"
                  ? "bg-white dark:bg-card text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200/50 dark:border-purple-900/50"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Login with Email</span>
            </button>
            <button
              type="button"
              onClick={() => handleMethodSwitch("mobile")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                method === "mobile"
                  ? "bg-white dark:bg-card text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200/50 dark:border-purple-900/50"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Login with Mobile</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 rounded-xl text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-medium flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {errorMsg.includes("Authorized Domains") && typeof window !== "undefined" && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.hostname);
                    toast.success("Domain copied to clipboard!");
                  }}
                  className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 hover:bg-rose-200 dark:hover:bg-rose-900/60 rounded-md font-mono text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy '{window.location.hostname}'
                </button>
              )}
            </div>
          )}

          {/* Method A: Email + Password Form */}
          {method === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="webmaster-email"
                  className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between"
                >
                  Webmaster Gmail Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="webmaster-email"
                    type="email"
                    required
                    autoComplete="username email"
                    disabled={status !== "idle"}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="linkcloud111@gmail.com"
                    className="w-full h-11 sm:h-12 pl-10 pr-3.5 bg-slate-50/80 dark:bg-muted/30 border border-slate-200 dark:border-border rounded-xl text-sm focus:border-purple-600 focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-purple-600/20 transition-all placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="webmaster-password"
                    className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={status !== "idle"}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:underline transition-colors disabled:opacity-50"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="webmaster-password"
                    type={showEmailPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    disabled={status !== "idle"}
                    value={emailPassword}
                    onChange={(e) => {
                      setEmailPassword(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="•••••••••••••••••"
                    className="w-full h-11 sm:h-12 pl-10 pr-11 bg-slate-50/80 dark:bg-muted/30 border border-slate-200 dark:border-border rounded-xl text-sm focus:border-purple-600 focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-purple-600/20 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    aria-label={showEmailPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    disabled={status !== "idle"}
                    className="absolute right-1 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                  >
                    {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status !== "idle"}
                className="w-full h-11 sm:h-12 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold rounded-xl text-sm sm:text-base transition-all shadow-md shadow-purple-600/25 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {status === "authenticating" ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : status === "success" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
                    <span>Login successful...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Login with Email</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Method B: Mobile Login Form */}
          {method === "mobile" && (
            <div className="space-y-4">
              {/* Mobile Verification Mode Switch (OTP vs Password) */}
              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMobileAuthMode("otp");
                    setErrorMsg("");
                  }}
                  className={`pb-1 border-b-2 transition-all ${
                    mobileAuthMode === "otp"
                      ? "border-purple-600 text-purple-600 dark:text-purple-400 font-bold"
                      : "border-transparent text-slate-500 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Verify via Mobile OTP
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileAuthMode("password");
                    setErrorMsg("");
                  }}
                  className={`pb-1 border-b-2 transition-all ${
                    mobileAuthMode === "password"
                      ? "border-purple-600 text-purple-600 dark:text-purple-400 font-bold"
                      : "border-transparent text-slate-500 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Verify via Password
                </button>
              </div>

              {/* Mobile Number Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="webmaster-mobile"
                  className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between"
                >
                  <span>Webmaster Mobile Number</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-muted-foreground">
                    India (+91 only)
                  </span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1 text-slate-500 font-bold text-xs sm:text-sm select-none border-r border-slate-300 dark:border-border pr-2.5">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    id="webmaster-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    disabled={status !== "idle" || (mobileAuthMode === "otp" && otpSent)}
                    value={mobileNumber}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setMobileNumber(digits);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="7987410765"
                    className="w-full h-11 sm:h-12 pl-24 pr-3.5 bg-slate-50/80 dark:bg-muted/30 border border-slate-200 dark:border-border rounded-xl text-sm font-mono tracking-wider focus:border-purple-600 focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-purple-600/20 transition-all placeholder:text-slate-400 disabled:opacity-60"
                  />
                </div>
                {mobileNumber.length > 0 && mobileNumber.length < 10 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Enter full 10-digit mobile number ({10 - mobileNumber.length} digits remaining)
                  </p>
                )}
              </div>

              {/* Sub-mode 1: OTP Flow */}
              {mobileAuthMode === "otp" && (
                <div className="space-y-3">
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendMobileOTP}
                      disabled={status !== "idle" || mobileNumber.length !== 10}
                      className="w-full h-11 sm:h-12 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold rounded-xl text-sm sm:text-base transition-all shadow-md shadow-purple-600/25 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {status === "authenticating" ? (
                        <>
                          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          <span>Sending Verification Code...</span>
                        </>
                      ) : (
                        <>
                          <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>Send OTP Code</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <form onSubmit={handleVerifyMobileOTP} className="space-y-3">
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold text-purple-900 dark:text-purple-200">
                          <span>OTP sent to +91 {mobileNumber}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setOtpSent(false);
                              setOtpCode("");
                              setConfirmationResult(null);
                              setErrorMsg("");
                            }}
                            className="text-purple-700 dark:text-purple-300 underline text-[11px] hover:text-purple-900"
                          >
                            Change Number
                          </button>
                        </div>
                        <p className="text-slate-500 dark:text-muted-foreground text-[11px]">
                          Enter the 6-digit code received via SMS.
                        </p>
                      </div>

                      {/* OTP Code Input */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="webmaster-otp"
                          className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
                        >
                          6-Digit OTP Code
                        </label>
                        <input
                          id="webmaster-otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          autoFocus
                          disabled={status !== "idle"}
                          value={otpCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setOtpCode(val);
                            if (errorMsg) setErrorMsg("");
                          }}
                          placeholder="123456"
                          className="w-full h-11 sm:h-12 text-center bg-slate-50/80 dark:bg-muted/30 border border-slate-200 dark:border-border rounded-xl text-lg font-mono tracking-[0.4em] font-bold focus:border-purple-600 focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-purple-600/20 transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 disabled:opacity-50"
                        />
                      </div>

                      {/* Submit Verify Button */}
                      <button
                        type="submit"
                        disabled={status !== "idle" || otpCode.length !== 6}
                        className="w-full h-11 sm:h-12 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold rounded-xl text-sm sm:text-base transition-all shadow-md shadow-purple-600/25 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {status === "authenticating" ? (
                          <>
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            <span>Verifying Code...</span>
                          </>
                        ) : status === "success" ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
                            <span>Verification Successful...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Verify OTP & Login</span>
                          </>
                        )}
                      </button>

                      {/* Resend Cooldown */}
                      <div className="text-center pt-1">
                        {resendTimer > 0 ? (
                          <span className="text-xs text-slate-500 dark:text-muted-foreground font-medium">
                            Resend code in <strong className="font-bold text-purple-600">{resendTimer}s</strong>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendMobileOTP}
                            disabled={status !== "idle"}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Resend Verification Code</span>
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Sub-mode 2: Mobile + Password Flow */}
              {mobileAuthMode === "password" && (
                <form onSubmit={handleMobilePasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="webmaster-mobile-password"
                      className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between"
                    >
                      Webmaster Password
                    </label>
                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      <input
                        id="webmaster-mobile-password"
                        type={showMobilePassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        disabled={status !== "idle"}
                        value={mobilePassword}
                        onChange={(e) => {
                          setMobilePassword(e.target.value);
                          if (errorMsg) setErrorMsg("");
                        }}
                        placeholder="•••••••••••••••••"
                        className="w-full h-11 sm:h-12 pl-10 pr-11 bg-slate-50/80 dark:bg-muted/30 border border-slate-200 dark:border-border rounded-xl text-sm focus:border-purple-600 focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-purple-600/20 transition-all disabled:opacity-50"
                      />
                      <button
                        type="button"
                        aria-label={showMobilePassword ? "Hide password" : "Show password"}
                        onClick={() => setShowMobilePassword(!showMobilePassword)}
                        disabled={status !== "idle"}
                        className="absolute right-1 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                      >
                        {showMobilePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={status !== "idle" || mobileNumber.length !== 10}
                    className="w-full h-11 sm:h-12 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold rounded-xl text-sm sm:text-base transition-all shadow-md shadow-purple-600/25 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {status === "authenticating" ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : status === "success" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
                        <span>Login successful...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Login with Mobile</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200 dark:border-border w-full" />
            <span className="bg-white dark:bg-card px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest absolute">
              OR
            </span>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={status !== "idle"}
            className="w-full h-11 sm:h-12 bg-white dark:bg-muted/20 hover:bg-slate-50 dark:hover:bg-muted/40 border border-slate-200 dark:border-border text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs disabled:opacity-50"
          >
            <SiGoogle className="w-4 h-4 text-rose-500" />
            <span>Sign in with Webmaster Google Account</span>
          </button>

          {/* Security Information Box */}
          <div className="p-3 sm:p-3.5 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/50 rounded-xl text-purple-900 dark:text-purple-200 text-xs text-center flex items-center justify-center gap-2 font-medium leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>
              Only authorized LinkCloud Webmaster credentials can access this portal. All access attempts are verified and recorded.
            </span>
          </div>

          {/* Bottom Navigation Links */}
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-muted-foreground pt-3 border-t border-slate-100 dark:border-border/60">
            <Link
              href="/login"
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> User Login
            </Link>
            <Link
              href="/"
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              Return to Directory <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Security Features Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <div className="p-3.5 bg-white/80 dark:bg-card/70 backdrop-blur-md border border-slate-200/80 dark:border-border/60 rounded-xl text-center shadow-xs space-y-0.5">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Dual-Factor Auth</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
              Email & Mobile OTP Protected
            </p>
          </div>

          <div className="p-3.5 bg-white/80 dark:bg-card/70 backdrop-blur-md border border-slate-200/80 dark:border-border/60 rounded-xl text-center shadow-xs space-y-0.5">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Restricted Portal</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
              Webmaster authorization only
            </p>
          </div>

          <div className="p-3.5 bg-white/80 dark:bg-card/70 backdrop-blur-md border border-slate-200/80 dark:border-border/60 rounded-xl text-center shadow-xs space-y-0.5">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>256-Bit SSL</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
              Encrypted end-to-end security
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 text-xs text-slate-500 dark:text-muted-foreground space-y-1">
          <div className="flex items-center justify-center gap-2 font-medium">
            <span>© {currentYear} LinkCloud. All rights reserved.</span>
            <span>•</span>
            <Link
              href="/privacy"
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            <span>•</span>
            <Link
              href="/terms"
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Invisible reCAPTCHA container for Phone Auth */}
      <div id="webmaster-recaptcha-container" />
    </div>
  );
}
