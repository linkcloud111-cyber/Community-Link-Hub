import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { loginWebmaster, signInWebmasterGoogle, sendPasswordResetLink, logout } from "@/lib/auth";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
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
} from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function WebmasterLogin() {
  const [, setLocation] = useLocation();
  const { user, isWebmaster, loading: authLoading, refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "authenticating" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Redirect if already logged in as authorized Webmaster, or clear invalid user session
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
        <p className="text-xs font-semibold text-slate-600 dark:text-muted-foreground">Verifying Webmaster Security Credentials...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setStatus("authenticating");

    try {
      await loginWebmaster(cleanEmail, password);
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
              Secure access to the LinkCloud administration portal.
            </p>
          </div>

          {/* Authorization Badge */}
          <div className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 text-xs font-bold text-center">
            <ShieldCheck className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>Authorized Webmaster Access Only</span>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 rounded-xl text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-medium flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="webmaster-email" className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                Webmaster Email Address
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
                  placeholder="webmaster@linkcloud.in"
                  className="w-full h-11 sm:h-12 pl-10 pr-3.5 bg-slate-50/80 dark:bg-muted/30 border border-slate-200 dark:border-border rounded-xl text-sm focus:border-purple-600 focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-purple-600/20 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="webmaster-password" className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
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
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  disabled={status !== "idle"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder="•••••••••••••••••"
                  className="w-full h-11 sm:h-12 pl-10 pr-11 bg-slate-50/80 dark:bg-muted/30 border border-slate-200 dark:border-border rounded-xl text-sm focus:border-purple-600 focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-purple-600/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={status !== "idle"}
                  className="absolute right-1 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  <span>Authenticate Webmaster</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
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
            <span>Only authorized LinkCloud Webmaster accounts can access this portal. Unauthorized access is strictly prohibited.</span>
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
              <span>Secure Access</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
              256-bit SSL encryption protected
            </p>
          </div>

          <div className="p-3.5 bg-white/80 dark:bg-card/70 backdrop-blur-md border border-slate-200/80 dark:border-border/60 rounded-xl text-center shadow-xs space-y-0.5">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Restricted Portal</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
              Webmaster access only
            </p>
          </div>

          <div className="p-3.5 bg-white/80 dark:bg-card/70 backdrop-blur-md border border-slate-200/80 dark:border-border/60 rounded-xl text-center shadow-xs space-y-0.5">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Protected Data</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
              Your data is safe and secure
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 text-xs text-slate-500 dark:text-muted-foreground space-y-1">
          <div className="flex items-center justify-center gap-2 font-medium">
            <span>© {currentYear} LinkCloud. All rights reserved.</span>
            <span>•</span>
            <Link href="/privacy" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors underline-offset-2 hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
