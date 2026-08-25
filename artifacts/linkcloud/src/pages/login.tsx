import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSignInMethodsForEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  loginUser,
  signInUserWithGoogle,
  signInWithMobileOTP,
  verifyOTP,
  sendPasswordResetLink,
  setAuthRememberMe,
  checkIsEmailRegistered,
  logout,
  type ConfirmationResult,
} from "@/lib/auth";
import {
  checkDuplicateUser,
  getUserProfileByEmail,
  getUserProfileByPhone,
} from "@/lib/firestore";
import {
  validateGmailAddress,
  validateIndianMobile,
  getFailedLoginAttempts,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
} from "@/lib/utils";
import { toast } from "sonner";
import {
  Cloud,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Field touched state for live validation
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Custom Error States for sequential step validation
  const [customEmailError, setCustomEmailError] = useState<string | null>(null);
  const [customPasswordError, setCustomPasswordError] = useState<string | null>(null);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [timer, setTimer] = useState(0);

  // Forgot Password Modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailTouched, setForgotEmailTouched] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { user, profile, isWebmaster, loading: authLoading, pendingEmail } = useAuth();

  useEffect(() => {
    let interval: any = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Prefill saved/remembered email on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem("saved_email") || window.localStorage.getItem("remember_me_email");
      if (saved && !identifier) {
        setIdentifier(saved);
      }
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      if (isWebmaster) {
        toast.error("This is a Webmaster account. Please sign in from the Webmaster Login page.");
        logout();
        setLocation("/webmaster/login");
      } else if (user.emailVerified || profile?.emailVerified || profile?.status === "active" || profile?.pendingEmail || pendingEmail) {
        setLocation("/dashboard");
      } else {
        setLocation("/verify-email");
      }
    }
  }, [user, profile, isWebmaster, authLoading, pendingEmail, setLocation]);

  if (authLoading || user) {
    return null;
  }

  // Detect input type
  const cleanNumber = identifier.replace(/[\s\-\+\(\)]/g, "");
  const isMobile = !identifier.includes("@") && (/^\d+$/.test(cleanNumber) || identifier.trim().startsWith("+91"));
  const isEmail = !isMobile;

  // Validation calculations
  const gmailCheck = validateGmailAddress(identifier);
  const mobileCheck = validateIndianMobile(identifier);

  let identifierError: string | null = null;
  let isIdentifierValid = false;

  if (isMobile) {
    isIdentifierValid = mobileCheck.valid && !customEmailError;
    if (customEmailError) {
      identifierError = customEmailError;
    } else if (identifierTouched || submitted) {
      if (!identifier.trim()) identifierError = "Enter a valid 10-digit mobile number.";
      else if (!mobileCheck.valid) identifierError = "Enter a valid 10-digit mobile number.";
    }
  } else {
    isIdentifierValid = gmailCheck.valid && !customEmailError;
    if (customEmailError) {
      identifierError = customEmailError;
    } else if (identifierTouched || submitted) {
      if (!identifier.trim()) {
        identifierError = "Enter a valid Gmail address.";
      } else if (!gmailCheck.valid) {
        identifierError = "Enter a valid Gmail address.";
      }
    }
  }

  const isPasswordValid = password.length >= 8 && !customPasswordError;
  let passwordError: string | null = null;

  // Rule: Never show both login ID error and password error at the same time.
  // Rule: Always validate login ID first, then password.
  if (customPasswordError) {
    passwordError = customPasswordError;
  } else if (passwordTouched || submitted) {
    if (!password || password.length < 8) {
      passwordError = "Incorrect password.";
    }
  }

  const isFormValid = isIdentifierValid && isPasswordValid && !loading;

  // Forgot password validation
  const forgotGmailCheck = validateGmailAddress(forgotEmail);
  const forgotEmailError = forgotEmailTouched
    ? (!forgotEmail.trim()
      ? "Email is required."
      : !forgotEmail.includes("@")
      ? "Enter a valid Gmail address."
      : !forgotEmail.toLowerCase().endsWith("@gmail.com")
      ? "Only @gmail.com addresses are allowed."
      : forgotGmailCheck.error || "Enter a valid Gmail address.")
    : null;

  const handleRememberChange = (checked: boolean) => {
    setRememberMe(checked);
    setAuthRememberMe(checked);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setIdentifierTouched(true);
    setPasswordTouched(true);
    setCustomEmailError(null);
    setCustomPasswordError(null);

    if (isMobile) {
      // 1. Check if Mobile format is valid
      const mobileCheckResult = validateIndianMobile(identifier.trim());
      if (!mobileCheckResult.valid) {
        setCustomEmailError("Enter a valid 10-digit mobile number.");
        toast.error("Enter a valid 10-digit mobile number.");
        return;
      }

      setLoading(true);

      try {
        // 2. Check if Mobile exists in database
        const userProfileByPhone = await getUserProfileByPhone(identifier.trim());
        if (!userProfileByPhone || !userProfileByPhone.email) {
          setCustomEmailError("Incorrect mobile number.");
          toast.error("Incorrect mobile number.");
          setLoading(false);
          return;
        }

        // Check account lockout status using registered email
        const lockout = getFailedLoginAttempts(userProfileByPhone.email);
        if (lockout.isLocked) {
          const mins = Math.ceil(lockout.remainingSec / 60);
          toast.error(`Account locked due to 5 failed login attempts. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
          setLoading(false);
          return;
        }

        // 3. Verify password
        if (!password || password.length < 8) {
          setCustomPasswordError("Incorrect password.");
          toast.error("Incorrect password.");
          setLoading(false);
          return;
        }

        await setAuthRememberMe(rememberMe);
        const u = await loginUser(userProfileByPhone.email, password);
        clearFailedLoginAttempts(userProfileByPhone.email);

        if (u.emailVerified) {
          toast.success("Welcome back to LinkCloud!");
          setLocation("/dashboard");
        } else {
          toast.info("Please verify your email address to access LinkCloud.");
          setLocation("/verify-email");
        }
      } catch (error: any) {
        console.error("Mobile login error:", error);
        setCustomPasswordError("Incorrect password.");
        toast.error(formatAuthError(error));
      } finally {
        setLoading(false);
      }
    } else {
      // 1. Check if Gmail syntax is valid (@gmail.com)
      const gmailCheckResult = validateGmailAddress(identifier.trim());
      if (!gmailCheckResult.valid) {
        setCustomEmailError("Enter a valid Gmail address.");
        toast.error("Enter a valid Gmail address.");
        if (!password || password.length < 8) {
          setCustomPasswordError("Incorrect password.");
        }
        return;
      }

      // Check account lockout status
      const lockout = getFailedLoginAttempts(gmailCheckResult.cleanEmail);
      if (lockout.isLocked) {
        const mins = Math.ceil(lockout.remainingSec / 60);
        toast.error(`Account locked due to 5 failed login attempts. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
        return;
      }

      setLoading(true);

      try {
        await setAuthRememberMe(rememberMe);

        // ALWAYS authenticate directly with Firebase Authentication as source of truth
        const u = await loginUser(gmailCheckResult.cleanEmail, password);
        clearFailedLoginAttempts(gmailCheckResult.cleanEmail);

        if (rememberMe && typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("saved_email", gmailCheckResult.cleanEmail);
          window.localStorage.setItem("remember_me_email", gmailCheckResult.cleanEmail);
          window.localStorage.setItem("user_email", gmailCheckResult.cleanEmail);
        }

        if (u.emailVerified) {
          toast.success("Login successful.");
          setLocation("/dashboard");
        } else {
          toast.info("Please verify your email address to access LinkCloud.");
          setLocation("/verify-email");
        }
      } catch (error: any) {
        console.warn("Login attempt failed:", error?.code || error?.message);

        const errCode = error?.code || "";
        const errMsg = String(error?.message || "");

        if (errCode === "auth/too-many-requests" || errMsg.includes("too-many-requests")) {
          toast.error("Too many failed attempts. Access temporarily disabled. Try again later or reset your password.");
          setLoading(false);
          return;
        }
        if (errCode === "auth/network-request-failed" || errMsg.includes("network-request-failed")) {
          toast.error("Network connection issue. Please check your internet connection.");
          setLoading(false);
          return;
        }
        if (errCode === "auth/user-token-expired" || errMsg.includes("token-expired")) {
          toast.error("Your session has expired. Please login again.");
          setLoading(false);
          return;
        }
        if (errCode === "auth/invalid-email" || errMsg.includes("invalid-email")) {
          setCustomEmailError("Invalid Gmail address format.");
          toast.error("Invalid Gmail address format.");
          setLoading(false);
          return;
        }
        if (errCode === "auth/user-not-found" || errMsg.includes("user-not-found")) {
          setCustomEmailError("Incorrect Gmail address.");
          toast.error("Incorrect Gmail address.");
          if (!password || password.length < 8) {
            setCustomPasswordError("Incorrect password.");
          }
          setLoading(false);
          return;
        }
        if (errCode === "auth/wrong-password" || errMsg.includes("wrong-password")) {
          setCustomEmailError(null);
          setCustomPasswordError("Incorrect password.");
          toast.error("Incorrect password.");
          recordFailedLoginAttempt(gmailCheckResult.cleanEmail);
          setLoading(false);
          return;
        }

        if (errCode === "auth/invalid-credential" || errMsg.includes("invalid-credential")) {
          let isRegistered = false;
          try {
            isRegistered = await checkIsEmailRegistered(gmailCheckResult.cleanEmail);
          } catch (e) {
            console.warn("Error checking email registration:", e);
          }

          if (isRegistered) {
            setCustomEmailError(null);
            setCustomPasswordError("Incorrect password.");
            toast.error("Incorrect password.");
            recordFailedLoginAttempt(gmailCheckResult.cleanEmail);
          } else {
            setCustomEmailError("Incorrect Gmail address or password.");
            toast.error("Incorrect Gmail address or password.");
            if (!password || password.length < 8) {
              setCustomPasswordError("Incorrect password.");
            }
          }
          setLoading(false);
          return;
        }

        // Handle auth/invalid-credential or other errors by checking email registration
        let isRegistered = false;
        try {
          isRegistered = await checkIsEmailRegistered(gmailCheckResult.cleanEmail);
        } catch (e) {
          console.warn("Error checking email registration:", e);
        }

        if (isRegistered) {
          setCustomEmailError(null);
          setCustomPasswordError("Incorrect password.");
          toast.error("Incorrect password.");
          recordFailedLoginAttempt(gmailCheckResult.cleanEmail);
        } else {
          setCustomEmailError("Incorrect Gmail address.");
          toast.error("Incorrect Gmail address.");
          if (!password || password.length < 8) {
            setCustomPasswordError("Incorrect password.");
          }
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSendOTP = async () => {
    setSubmitted(true);
    setIdentifierTouched(true);

    if (!mobileCheck.valid) {
      toast.error(mobileCheck.error || "Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    try {
      await setAuthRememberMe(rememberMe);
      const res = await signInWithMobileOTP(identifier.trim(), "recaptcha-container");
      setConfirmationResult(res);
      setOtpSent(true);
      setTimer(30);
      toast.success("OTP sent to your mobile number!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to send OTP. Ensure reCAPTCHA completes and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) {
      toast.error("Please request OTP first.");
      return;
    }
    if (!otpCode || otpCode.length < 6) {
      toast.error("Please enter valid 6-digit OTP code.");
      return;
    }
    setLoading(true);
    try {
      await verifyOTP(confirmationResult, otpCode.trim());
      toast.success("Mobile OTP verified successfully!");
      setLocation("/dashboard");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Invalid OTP code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await setAuthRememberMe(rememberMe);
      await signInUserWithGoogle();
      toast.success("Welcome to LinkCloud!");
      setLocation("/dashboard");
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.startsWith("This is a Webmaster account")) {
        // Stop execution, error toast and redirect already performed
        return;
      }
      toast.error(error.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotEmailTouched(true);
    if (!forgotGmailCheck.valid) {
      toast.error(forgotGmailCheck.error || "Please enter a valid registered Gmail address.");
      return;
    }
    setForgotLoading(true);
    try {
      await sendPasswordResetLink(forgotGmailCheck.cleanEmail);
      setForgotSuccess(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send password reset link.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Invisible container for Firebase Phone Recaptcha */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md">
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-blue-500 to-indigo-600" />

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
              <Cloud className="w-9 h-9" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Welcome Back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in with Email or Mobile OTP to manage communities
            </p>
          </div>

          {/* Single Smart Input Section */}
          <div className="space-y-5">
            {/* Input label & type indicator */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address or Mobile Number
                </label>
                {identifier.length > 0 && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {isMobile ? "Mobile Detected" : "Gmail Mode"}
                  </span>
                )}
              </div>

              <div className="relative">
                {isMobile ? (
                  <Phone className="absolute left-3.5 top-3.5 w-5 h-5 text-blue-500" />
                ) : (
                  <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-primary" />
                )}
                <input
                  type="text"
                  required
                  value={identifier}
                  disabled={otpSent || loading}
                  onBlur={() => setIdentifierTouched(true)}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setCustomEmailError(null);
                    setCustomPasswordError(null);
                    setOtpSent(false);
                    setConfirmationResult(null);
                    setIdentifierTouched(true);
                  }}
                  className={`w-full pl-11 pr-10 py-3 bg-background/50 border rounded-xl text-sm outline-none transition-all placeholder:text-muted-foreground/60 ${
                    identifierTouched || submitted
                      ? identifierError
                        ? "border-destructive focus:ring-2 focus:ring-destructive"
                        : isIdentifierValid
                        ? "border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        : "border-border focus:ring-2 focus:ring-primary"
                      : "border-border focus:ring-2 focus:ring-primary"
                  }`}
                  placeholder="name@gmail.com or 9876543210"
                />

                {/* Right Status Icon */}
                <div className="absolute right-3.5 top-3.5">
                  {(identifierTouched || submitted) && identifierError && (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                  {(identifierTouched || submitted) && !identifierError && isIdentifierValid && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                </div>
              </div>

              {/* Error Helper Text */}
              {identifierError && (
                <p className="text-xs font-medium text-destructive px-1 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5" /> {identifierError}
                </p>
              )}
            </div>

            {/* IF EMAIL MODE OR NEUTRAL DEFAULT */}
            {!otpSent && (
              <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotModalOpen(true);
                        setForgotEmail(isEmail ? identifier : "");
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!isMobile}
                      value={password}
                      disabled={loading}
                      onBlur={() => setPasswordTouched(true)}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setCustomPasswordError(null);
                        setPasswordTouched(true);
                      }}
                      className={`w-full pl-11 pr-16 py-3 bg-background/50 border rounded-xl text-sm outline-none transition-all placeholder:text-muted-foreground/60 ${
                        passwordTouched || submitted
                          ? passwordError
                            ? "border-destructive focus:ring-2 focus:ring-destructive"
                            : isPasswordValid
                            ? "border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                            : "border-border focus:ring-2 focus:ring-primary"
                          : "border-border focus:ring-2 focus:ring-primary"
                      }`}
                      placeholder="••••••••"
                    />

                    {/* Status icon and Toggle */}
                    <div className="absolute right-3.5 top-3.5 flex items-center gap-2">
                      {(passwordTouched || submitted) && passwordError && (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                      {(passwordTouched || submitted) && !passwordError && isPasswordValid && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Error Text */}
                  {passwordError && (
                    <p className="text-xs font-medium text-destructive px-1 flex items-center gap-1 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
                    </p>
                  )}
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center justify-between px-1 py-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => handleRememberChange(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    Remember Me on this device
                  </label>
                </div>

                {/* Submit Button */}
                {isMobile ? (
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={loading || !mobileCheck.valid}
                    className="w-full py-3.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Phone className="w-4 h-4" /> Send Mobile OTP <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 group shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                )}
              </form>
            )}

            {/* IF MOBILE OTP SENT MODE */}
            {otpSent && (
              <form onSubmit={handleVerifyOTP} className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <span>OTP code sent to <strong>{identifier}</strong></span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    Enter 6-Digit OTP
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3.5 w-5 h-5 text-primary" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-background/50 border border-border rounded-xl text-center font-mono text-lg tracking-widest focus:ring-2 focus:ring-primary outline-none"
                      placeholder="123456"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={timer > 0 || loading}
                    onClick={handleSendOTP}
                    className="text-xs font-semibold text-primary disabled:text-muted-foreground hover:underline"
                  >
                    {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setConfirmationResult(null);
                    }}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Change Number
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full py-3.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Verify & Login <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-muted-foreground font-medium uppercase tracking-wider">
                  Or Continue With
                </span>
              </div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-background border border-border font-semibold text-sm rounded-xl hover:bg-muted/50 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
            >
              <FcGoogle className="w-5 h-5" /> Continue with Google
            </button>

            {/* Sign Up Redirect */}
            <p className="text-center mt-6 text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="font-semibold text-primary hover:underline">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setForgotModalOpen(false);
                setForgotSuccess(false);
              }}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Reset Password</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your registered Gmail address. We will send a secure password reset link.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Password Reset Email Sent!
                </p>
                <p className="text-xs text-muted-foreground">
                  Please check your email inbox and follow the instructions to create a new password.
                </p>
                <button
                  onClick={() => {
                    setForgotModalOpen(false);
                    setForgotSuccess(false);
                  }}
                  className="w-full py-2.5 bg-muted text-foreground font-semibold text-sm rounded-xl hover:bg-muted/80"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordReset} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    Registered Gmail Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onBlur={() => setForgotEmailTouched(true)}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setForgotEmailTouched(true);
                      }}
                      className={`w-full pl-11 pr-10 py-3 bg-background border rounded-xl text-sm outline-none transition-all ${
                        forgotEmailTouched
                          ? forgotEmailError
                            ? "border-destructive focus:ring-2 focus:ring-destructive"
                            : forgotGmailCheck.valid
                            ? "border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                            : "border-border focus:ring-2 focus:ring-primary"
                          : "border-border focus:ring-2 focus:ring-primary"
                      }`}
                      placeholder="you@gmail.com"
                    />
                    <div className="absolute right-3.5 top-3.5">
                      {forgotEmailTouched && forgotEmailError && (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                      {forgotEmailTouched && !forgotEmailError && forgotGmailCheck.valid && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                  </div>

                  {forgotEmailError && (
                    <p className="text-xs font-medium text-destructive px-1 flex items-center gap-1 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5" /> {forgotEmailError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotGmailCheck.valid}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
