import { useState, useEffect } from "react";
import { Phone, X, CheckCircle2, AlertCircle, Loader2, ArrowLeft, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { User, ConfirmationResult } from "firebase/auth";
import type { UserProfile } from "@/lib/types";
import { validateNewMobile, cleanMobileInput, extract10DigitMobile } from "@/lib/utils";
import { signInWithMobileOTP, verifyOTP } from "@/lib/auth";
import { checkDuplicateUser, updateUserProfile } from "@/lib/firestore";

interface VerifyPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  profile: UserProfile | null;
  onSuccess?: () => Promise<void> | void;
}

type FieldStatus = "neutral" | "valid" | "invalid";

export function VerifyPhoneModal({
  isOpen,
  onClose,
  user,
  profile,
  onSuccess,
}: VerifyPhoneModalProps) {
  const currentPhone = profile?.phone || user?.phoneNumber || "";
  const current10Digit = extract10DigitMobile(currentPhone);

  // Step 1 states (Inputs start completely EMPTY on open)
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  // Step 2 states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Reset all state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPhone("");
      setConfirmPhone("");
      setTouchedPhone(false);
      setTouchedConfirm(false);
      setOtpSent(false);
      setOtpCode("");
      setConfirmationResult(null);
      setCooldown(0);
      setLoading(false);
    }
    return () => {
      setPhone("");
      setConfirmPhone("");
      setTouchedPhone(false);
      setTouchedConfirm(false);
      setOtpSent(false);
      setOtpCode("");
      setConfirmationResult(null);
      setCooldown(0);
      setLoading(false);
    };
  }, [isOpen]);

  // Cooldown countdown timer (strictly 60 seconds)
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  // Real-time Validations
  const phoneCheck = validateNewMobile(phone, currentPhone);

  let phoneStatus: FieldStatus = "neutral";
  let phoneError: string | null = null;
  if (touchedPhone || phone.length > 0) {
    if (!phone.trim()) {
      phoneStatus = "invalid";
      phoneError = "Mobile number is required.";
    } else if (!phoneCheck.valid) {
      phoneStatus = "invalid";
      phoneError = phoneCheck.error || "Please enter a valid 10-digit Indian mobile number.";
    } else {
      phoneStatus = "valid";
    }
  }

  let confirmStatus: FieldStatus = "neutral";
  let confirmError: string | null = null;
  if (touchedConfirm || confirmPhone.length > 0) {
    if (!confirmPhone.trim()) {
      confirmStatus = "invalid";
      confirmError = "Please confirm your mobile number.";
    } else if (cleanMobileInput(confirmPhone) !== cleanMobileInput(phone)) {
      confirmStatus = "invalid";
      confirmError = "Mobile numbers do not match.";
    } else if (phoneStatus === "valid") {
      confirmStatus = "valid";
    } else {
      confirmStatus = "neutral";
    }
  }

  const isStep1Valid =
    phoneStatus === "valid" &&
    confirmStatus === "valid" &&
    !loading;

  const handleClose = () => {
    if (loading) return;
    setPhone("");
    setConfirmPhone("");
    setTouchedPhone(false);
    setTouchedConfirm(false);
    setOtpSent(false);
    setOtpCode("");
    setConfirmationResult(null);
    setCooldown(0);
    onClose();
  };

  // Handle Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouchedPhone(true);
    setTouchedConfirm(true);

    const check = validateNewMobile(phone, currentPhone);
    if (!check.valid) {
      toast.error(check.error || "Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (cleanMobileInput(confirmPhone) !== cleanMobileInput(phone)) {
      toast.error("Mobile numbers do not match.");
      return;
    }

    setLoading(true);
    try {
      // Check duplicate user in Firestore
      const duplicates = await checkDuplicateUser("", check.formatted);
      if (duplicates.phoneExists && current10Digit !== check.raw10) {
        toast.error("This mobile number is already registered with another account.");
        setLoading(false);
        return;
      }

      const res = await signInWithMobileOTP(check.formatted, "phone-modal-recaptcha");
      setConfirmationResult(res);
      setOtpSent(true);
      setCooldown(60);
      toast.success(`OTP sent to +91 ${check.raw10}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOTP = async () => {
    if (cooldown > 0 || loading) return;
    const check = validateNewMobile(phone, currentPhone);
    if (!check.valid) return;

    setLoading(true);
    try {
      const res = await signInWithMobileOTP(check.formatted, "phone-modal-recaptcha");
      setConfirmationResult(res);
      setCooldown(60);
      toast.success(`New OTP code sent to +91 ${check.raw10}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || !otpCode || otpCode.trim().length < 6) {
      toast.error("Please enter the 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(confirmationResult, otpCode.trim());
      if (user) {
        const check = validateNewMobile(phone, currentPhone);
        const formattedSaved = `+91 ${check.raw10}`;
        await updateUserProfile(user.uid, {
          phone: formattedSaved,
          phoneVerified: true,
        });
      }

      if (onSuccess) {
        await onSuccess();
      }

      // Single success toast
      toast.success("Mobile number verified successfully!");
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Invalid OTP code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Invisible reCAPTCHA container for Phone Auth */}
      <div id="phone-modal-recaptcha"></div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/70 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Verify Indian Mobile
              </h3>
              <p className="text-xs text-slate-500">10-digit number (+91)</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Mobile Reference Box */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-0.5">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Current Mobile:
          </span>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {currentPhone ? (currentPhone.startsWith("+91") ? currentPhone : `+91 ${current10Digit}`) : "No mobile number linked"}
          </span>
        </div>

        {/* Step 1: Input Mobile Number */}
        {!otpSent ? (
          <form onSubmit={handleSendOTP} autoComplete="off" className="space-y-4">
            {/* Field 1: Mobile Number with fixed +91 prefix */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                {/* Permanent non-editable +91 prefix badge */}
                <div className="absolute left-0 inset-y-0 flex items-center pl-3 pr-2.5 pointer-events-none border-r border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 select-none">
                  +91
                </div>

                <input
                  type="tel"
                  name="lc_target_new_phone"
                  id="lc_target_new_phone"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(e) => {
                    const cleaned = cleanMobileInput(e.target.value);
                    setPhone(cleaned);
                    if (!touchedPhone) setTouchedPhone(true);
                  }}
                  onBlur={() => setTouchedPhone(true)}
                  placeholder="9876543210"
                  className={`w-full pl-14 pr-10 py-2.5 rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 ${
                    phoneStatus === "valid"
                      ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 focus:ring-emerald-500 text-slate-900 dark:text-white border"
                      : phoneStatus === "invalid"
                      ? "border-rose-500 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500 text-slate-900 dark:text-white border"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-purple-600 text-slate-900 dark:text-white border"
                  }`}
                />

                {phoneStatus === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 pointer-events-none" />
                )}
                {phoneStatus === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-3 pointer-events-none" />
                )}
              </div>
              {phoneStatus === "invalid" && phoneError && (
                <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{phoneError}</span>
                </p>
              )}
            </div>

            {/* Field 2: Confirm Mobile Number with fixed +91 prefix */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Confirm Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                {/* Permanent non-editable +91 prefix badge */}
                <div className="absolute left-0 inset-y-0 flex items-center pl-3 pr-2.5 pointer-events-none border-r border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 select-none">
                  +91
                </div>

                <input
                  type="tel"
                  name="lc_target_confirm_phone"
                  id="lc_target_confirm_phone"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  required
                  value={confirmPhone}
                  onChange={(e) => {
                    const cleaned = cleanMobileInput(e.target.value);
                    setConfirmPhone(cleaned);
                    if (!touchedConfirm) setTouchedConfirm(true);
                  }}
                  onBlur={() => setTouchedConfirm(true)}
                  placeholder="Confirm 9876543210"
                  className={`w-full pl-14 pr-10 py-2.5 rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 ${
                    confirmStatus === "valid"
                      ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 focus:ring-emerald-500 text-slate-900 dark:text-white border"
                      : confirmStatus === "invalid"
                      ? "border-rose-500 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500 text-slate-900 dark:text-white border"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-purple-600 text-slate-900 dark:text-white border"
                  }`}
                />

                {confirmStatus === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 pointer-events-none" />
                )}
                {confirmStatus === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-3 pointer-events-none" />
                )}
              </div>
              {confirmStatus === "invalid" && confirmError && (
                <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{confirmError}</span>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={handleClose}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!isStep1Valid || loading}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <span>Send OTP Code</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Input 6-digit OTP */
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/50 text-xs text-purple-900 dark:text-purple-200">
              Enter the 6-digit code sent via SMS to <span className="font-bold">+91 {phone}</span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                6-Digit OTP Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full px-3.5 py-3 rounded-xl text-center font-mono tracking-widest text-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>

            {/* Resend OTP with 60s cooldown */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-500">Didn't receive code?</span>
              {cooldown > 0 ? (
                <span className="text-slate-400 font-medium">
                  Resend in <span className="font-bold text-purple-600 dark:text-purple-400">{cooldown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResendOTP}
                  className="inline-flex items-center gap-1 font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Resend OTP</span>
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode("");
                }}
                disabled={loading}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={loading || otpCode.trim().length < 6}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify & Link Number</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
