import { Link2, ShieldCheck, Mail, Phone, Lock, ExternalLink } from "lucide-react";
import type { UserProfile } from "@/lib/types";

interface ConnectedAccountsTabProps {
  profile: UserProfile | null;
  email: string | null;
  isEmailVerified: boolean;
}

export function ConnectedAccountsTab({
  profile,
  email,
  isEmailVerified,
}: ConnectedAccountsTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Connected Accounts & Auth Providers</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Identity providers linked to your LinkCloud login credentials
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email & Password */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Email & Password</h3>
                <p className="text-xs text-slate-500">{email || profile?.email || "No email"}</p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                isEmailVerified
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
              }`}
            >
              {isEmailVerified ? "VERIFIED" : "UNVERIFIED"}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Primary email address used for LinkCloud password resets and administrative communications.
          </p>
        </div>

        {/* Mobile Number OTP */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Phone Authentication</h3>
                <p className="text-xs text-slate-500">{profile?.phone || "No phone linked"}</p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                profile?.phoneVerified
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {profile?.phoneVerified ? "LINKED" : "OPTIONAL"}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Enables instant OTP verification and expedited submission status notifications.
          </p>
        </div>
      </div>
    </div>
  );
}
