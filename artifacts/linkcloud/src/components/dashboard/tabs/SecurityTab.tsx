import { useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Shield,
  Smartphone,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { validatePasswordStrength } from "@/lib/utils";
import { AccountSecuritySection } from "@/components/dashboard/AccountSecuritySection";
import type { UserProfile } from "@/lib/types";

interface SecurityTabProps {
  profile: UserProfile | null;
  email: string | null;
  isEmailVerified: boolean;
  onChangePassword: (currentPass: string, newPass: string) => Promise<void>;
  onRequestDeletion: (reason: string) => Promise<void>;
  onCancelDeletion: () => Promise<void>;
  onOpenPhoneModal: () => void;
}

export function SecurityTab({
  profile,
  email,
  isEmailVerified,
  onChangePassword,
  onRequestDeletion,
  onCancelDeletion,
  onOpenPhoneModal,
}: SecurityTabProps) {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);

  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  const passwordValidation = validatePasswordStrength(newPass);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);

    if (!currentPass) {
      toast.error("Please enter your current password.");
      return;
    }

    if (!passwordValidation.valid) {
      toast.error(passwordValidation.error || "New password does not meet requirements.");
      return;
    }

    if (newPass !== confirmNewPass) {
      toast.error("New passwords do not match.");
      return;
    }

    setSavingPass(true);
    try {
      await onChangePassword(currentPass, newPass);
      setCurrentPass("");
      setNewPass("");
      setConfirmNewPass("");
      toast.success("Password changed successfully!");
    } catch (err: any) {
      const msg = err?.message || "Failed to update password.";
      if (msg.includes("wrong-password") || msg.includes("Incorrect current password")) {
        setPassError("Incorrect current password.");
      } else {
        setPassError(msg);
      }
      toast.error(msg);
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Account Security & Credentials</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your password, two-factor authentication, and account lifecycle status
            </p>
          </div>
        </div>
      </div>

      {/* Account Security & Deletion Section */}
      <AccountSecuritySection
        profile={profile}
        email={email}
        isEmailVerified={isEmailVerified}
        onRequestDeletion={onRequestDeletion}
        onCancelDeletion={onCancelDeletion}
      />

      {/* Change Password Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create a strong password with at least 8 characters, uppercase, and digits
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePasswordSubmit} className="space-y-4 max-w-xl">
          {passError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPass ? "text" : "password"}
                required
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Enter current password..."
                className="w-full pl-3.5 pr-10 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-1 top-1 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg"
                aria-label={showCurrentPass ? "Hide password" : "Show password"}
              >
                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="New password..."
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-1 top-1 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg"
                  aria-label={showNewPass ? "Hide password" : "Show password"}
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmNewPass ? "text" : "password"}
                  required
                  value={confirmNewPass}
                  onChange={(e) => setConfirmNewPass(e.target.value)}
                  placeholder="Confirm new password..."
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPass(!showConfirmNewPass)}
                  className="absolute right-1 top-1 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg"
                  aria-label={showConfirmNewPass ? "Hide password" : "Show password"}
                >
                  {showConfirmNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPass || !currentPass || !newPass || !confirmNewPass}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition shadow-sm"
          >
            {savingPass ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating password...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Update Password</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
