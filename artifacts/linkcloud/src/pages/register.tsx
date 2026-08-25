import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { registerWithEmail, signInWithGoogle } from "@/lib/auth";
import {
  validateGmailAddress,
  validatePasswordStrength,
  validateFullName,
  validateDob,
  validateIndianMobile,
  formatFullName,
  cleanMobileInput,
} from "@/lib/utils";
import { toast } from "sonner";
import {
  Cloud,
  User,
  Calendar,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Custom error states for duplicate check errors
  const [customEmailError, setCustomEmailError] = useState<string | null>(null);
  const [customPhoneError, setCustomPhoneError] = useState<string | null>(null);

  // Field touched state for inline errors
  const [touched, setTouched] = useState({
    fullName: false,
    dob: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
    agreeTerms: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isWebmaster, loading: authLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (isWebmaster) {
        setLocation("/webmaster/dashboard");
      } else if (user.emailVerified) {
        setLocation("/dashboard");
      } else {
        setLocation("/verify-email");
      }
    }
  }, [user, isWebmaster, authLoading, setLocation]);

  if (authLoading || user) {
    return null;
  }

  // Real-time Validations
  const nameVal = validateFullName(fullName);
  const fullNameError = (touched.fullName || submitted) && !nameVal.valid ? nameVal.error : null;

  const dobVal = validateDob(dob);
  const dobError = (touched.dob || submitted) && !dobVal.valid ? dobVal.error : null;

  const emailVal = validateGmailAddress(email);
  const emailError = customEmailError || ((touched.email || submitted) && !emailVal.valid ? (emailVal.error || "Only Gmail addresses are allowed.") : null);

  const phoneVal = validateIndianMobile(phone);
  const phoneError = customPhoneError || ((touched.phone || submitted) && !phoneVal.valid ? (phoneVal.error || "Enter a valid Indian mobile number.") : null);

  const passVal = validatePasswordStrength(password);
  const passwordError = (touched.password || submitted) && !passVal.valid ? (passVal.error || "Password must contain uppercase, lowercase, number and special character.") : null;

  const confirmMatch = confirmPassword.length > 0 && confirmPassword === password;
  const confirmPasswordError = (touched.confirmPassword || submitted)
    ? (!confirmPassword ? "Please confirm your password." : (!confirmMatch ? "Passwords do not match." : null))
    : null;

  const termsError = (touched.agreeTerms || submitted) && !agreeTerms ? "You must accept Terms & Privacy Policy." : null;

  // Form Overall Validity
  const isFormValid =
    nameVal.valid &&
    dobVal.valid &&
    emailVal.valid &&
    phoneVal.valid &&
    passVal.valid &&
    confirmMatch &&
    agreeTerms;

  // Password Strength Visual Indicator
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "None", color: "bg-muted" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 1, label: "Weak", color: "bg-destructive" };
    if (score === 2) return { score: 2, label: "Medium", color: "bg-amber-500" };
    return { score: 3, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength(password);

  const handleBlur = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTouched({
      fullName: true,
      dob: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      agreeTerms: true,
    });

    // STRICT GUARD: Do NOT create Firebase Auth user if ANY validation fails!
    if (!nameVal.valid) {
      toast.error(nameVal.error || "Full Name must contain at least 3 letters.");
      return;
    }
    if (!dobVal.valid) {
      toast.error(dobVal.error || "You must be at least 18 years old.");
      return;
    }
    if (!emailVal.valid) {
      toast.error(emailVal.error || "Only Gmail addresses are allowed.");
      return;
    }
    if (!phoneVal.valid) {
      toast.error(phoneVal.error || "Enter a valid Indian mobile number.");
      return;
    }
    if (!passVal.valid) {
      toast.error(passVal.error || "Password must contain uppercase, lowercase, number and special character.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!agreeTerms) {
      toast.error("You must accept Terms & Privacy Policy.");
      return;
    }

    setCustomEmailError(null);
    setCustomPhoneError(null);
    setLoading(true);
    try {
      await registerWithEmail({
        fullName: fullName.trim(),
        dob,
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      toast.success("Account created successfully! Verification link sent to your Gmail.");
      setLocation("/verify-email");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || "Failed to create account. Please try again.";
      if (msg.includes("Gmail") || msg.includes("email") || msg.includes("registered") || msg.includes("Mobile") || msg.includes("phone")) {
        if (msg.includes("Mobile") || msg.includes("phone")) {
          setCustomPhoneError(msg);
          toast.error(msg);
        } else {
          const emailErrMsg = msg.includes("registered") ? "This email address is already registered." : msg;
          setCustomEmailError(emailErrMsg);
          toast.error(emailErrMsg);
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Welcome to LinkCloud!");
      setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to sign up with Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background py-10">
      <div className="w-full max-w-xl">
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-blue-500 to-indigo-600" />

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
              <Cloud className="w-9 h-9" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Create an Account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Join LinkCloud to submit and manage your community listings
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5" noValidate>
            {/* Full Name & DOB */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(formatFullName(e.target.value))}
                    onBlur={() => handleBlur("fullName")}
                    className={`w-full pl-11 pr-4 py-3 bg-background/50 border rounded-xl text-sm focus:ring-2 outline-none transition ${
                      fullNameError
                        ? "border-destructive focus:ring-destructive"
                        : touched.fullName && nameVal.valid
                        ? "border-emerald-500 focus:ring-emerald-500"
                        : "border-border focus:ring-primary"
                    }`}
                    placeholder="John Doe"
                  />
                  {touched.fullName && nameVal.valid && (
                    <CheckCircle2 className="absolute right-3.5 top-3.5 w-5 h-5 text-emerald-500" />
                  )}
                </div>
                {fullNameError && (
                  <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {fullNameError}
                  </p>
                )}
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex justify-between">
                  <span>Date of Birth *</span>
                  <span className="text-[10px] text-muted-foreground lowercase font-normal">(Min 18 yrs)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    onBlur={() => handleBlur("dob")}
                    className={`w-full pl-11 pr-4 py-3 bg-background/50 border rounded-xl text-sm focus:ring-2 outline-none transition ${
                      dobError
                        ? "border-destructive focus:ring-destructive"
                        : touched.dob && dobVal.valid
                        ? "border-emerald-500 focus:ring-emerald-500"
                        : "border-border focus:ring-primary"
                    }`}
                  />
                  {touched.dob && dobVal.valid && (
                    <CheckCircle2 className="absolute right-3.5 top-3.5 w-5 h-5 text-emerald-500" />
                  )}
                </div>
                {dobError && (
                  <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {dobError}
                  </p>
                )}
              </div>
            </div>

            {/* Gmail & Indian Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Gmail Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex justify-between">
                  <span>Gmail Address *</span>
                  <span className="text-[10px] text-primary font-medium">@gmail.com only</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setCustomEmailError(null);
                    }}
                    onBlur={() => handleBlur("email")}
                    className={`w-full pl-11 pr-4 py-3 bg-background/50 border rounded-xl text-sm focus:ring-2 outline-none transition ${
                      emailError
                        ? "border-destructive focus:ring-destructive"
                        : touched.email && emailVal.valid
                        ? "border-emerald-500 focus:ring-emerald-500"
                        : "border-border focus:ring-primary"
                    }`}
                    placeholder="username@gmail.com"
                  />
                  {touched.email && emailVal.valid && (
                    <CheckCircle2 className="absolute right-3.5 top-3.5 w-5 h-5 text-emerald-500" />
                  )}
                </div>
                {emailError && (
                  <div className="text-xs text-destructive font-medium px-1 flex items-center justify-between gap-1.5 mt-1">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {emailError}
                    </span>
                    {emailError.includes("registered") && (
                      <Link href="/login" className="text-primary hover:underline font-bold text-xs whitespace-nowrap">
                        Sign in →
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex justify-between">
                  <span>Mobile Number *</span>
                  <span className="text-[10px] text-muted-foreground font-medium">10 Digits (India)</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1.5 text-muted-foreground select-none">
                    <Phone className="w-5 h-5" />
                    <span className="text-xs font-bold text-foreground border-r border-border pr-2">+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      setPhone(cleanMobileInput(e.target.value));
                      setCustomPhoneError(null);
                    }}
                    onBlur={() => handleBlur("phone")}
                    className={`w-full pl-24 pr-4 py-3 bg-background/50 border rounded-xl text-sm focus:ring-2 outline-none transition ${
                      phoneError
                        ? "border-destructive focus:ring-destructive"
                        : touched.phone && phoneVal.valid
                        ? "border-emerald-500 focus:ring-emerald-500"
                        : "border-border focus:ring-primary"
                    }`}
                    placeholder="9876543210"
                  />
                  {touched.phone && phoneVal.valid && (
                    <CheckCircle2 className="absolute right-3.5 top-3.5 w-5 h-5 text-emerald-500" />
                  )}
                </div>
                {phoneError && (
                  <div className="text-xs text-destructive font-medium px-1 flex items-center justify-between gap-1.5 mt-1">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {phoneError}
                    </span>
                    {phoneError.includes("registered") && (
                      <Link href="/login" className="text-primary hover:underline font-bold text-xs whitespace-nowrap">
                        Sign in →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur("password")}
                    className={`w-full pl-11 pr-11 py-3 bg-background/50 border rounded-xl text-sm focus:ring-2 outline-none transition ${
                      passwordError
                        ? "border-destructive focus:ring-destructive"
                        : touched.password && passVal.valid
                        ? "border-emerald-500 focus:ring-emerald-500"
                        : "border-border focus:ring-primary"
                    }`}
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {passwordError}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => handleBlur("confirmPassword")}
                    className={`w-full pl-11 pr-16 py-3 bg-background/50 border rounded-xl text-sm focus:ring-2 outline-none transition ${
                      confirmPasswordError
                        ? "border-destructive focus:ring-destructive"
                        : touched.confirmPassword && confirmMatch
                        ? "border-emerald-500 focus:ring-emerald-500"
                        : "border-border focus:ring-primary"
                    }`}
                    placeholder="Repeat password"
                  />
                  <div className="absolute right-3.5 top-3.5 flex items-center gap-2">
                    {touched.confirmPassword && confirmMatch && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {confirmPasswordError && (
                  <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {confirmPasswordError}
                  </p>
                )}
              </div>
            </div>

            {/* Password Strength Visual Indicator */}
            {password && (
              <div className="space-y-1.5 px-1 bg-muted/30 p-3 rounded-xl border border-border">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Strength: <strong className="text-foreground font-semibold">{strength.label}</strong></span>
                  <span className="text-[11px]">8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                  <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : "bg-muted"}`} />
                  <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : "bg-muted"}`} />
                  <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : "bg-muted"}`} />
                </div>
              </div>
            )}

            {/* Terms & Privacy Checkbox */}
            <div className="pt-2 px-1 space-y-1">
              <label className="flex items-start gap-3 cursor-pointer text-xs font-medium text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    setTouched((prev) => ({ ...prev, agreeTerms: true }));
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/privacy" className="text-primary font-semibold hover:underline">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="text-primary font-semibold hover:underline">
                    Terms & Conditions
                  </Link>{" "}
                  of LinkCloud.
                </span>
              </label>
              {termsError && (
                <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {termsError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="w-full py-3.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Validating & Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-muted-foreground font-medium uppercase tracking-wider">
                  Or Sign Up With
                </span>
              </div>
            </div>

            {/* Google Signup */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full py-3 px-4 bg-background border border-border font-semibold text-sm rounded-xl hover:bg-muted/50 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <FcGoogle className="w-5 h-5" /> Continue with Google
            </button>

            {/* Login Link */}
            <p className="text-center mt-6 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
