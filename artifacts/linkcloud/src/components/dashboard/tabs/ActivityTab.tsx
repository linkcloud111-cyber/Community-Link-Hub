import { Activity, Clock, ShieldCheck, CheckCircle2, User, Layers, KeyRound } from "lucide-react";
import type { UserProfile, Group, Notification } from "@/lib/types";

interface ActivityTabProps {
  profile: UserProfile | null;
  groups: Group[];
  notifications: Notification[];
}

export function ActivityTab({ profile, groups, notifications }: ActivityTabProps) {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Recent";
    try {
      const d =
        timestamp.toDate?.() ||
        (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return "Recent";
    }
  };

  // Build events
  const events = [];

  if (profile?.createdAt) {
    events.push({
      id: "account-created",
      title: "Account Created & Registered",
      desc: `Joined LinkCloud with permanent identifier ${profile.accountUid || "UID"}`,
      time: profile.createdAt,
      icon: User,
      color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60",
    });
  }

  if (profile?.emailVerified) {
    events.push({
      id: "email-verified",
      title: "Email Address Verified",
      desc: `Primary authentication email (${profile.email}) successfully verified`,
      time: profile.updatedAt || profile.createdAt,
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60",
    });
  }

  if (profile?.phoneVerified) {
    events.push({
      id: "phone-verified",
      title: "Mobile Number Verified via OTP",
      desc: `Secure 2FA contact verified (${profile.phone})`,
      time: profile.updatedAt || profile.createdAt,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60",
    });
  }

  groups.slice(0, 5).forEach((grp) => {
    events.push({
      id: `group-${grp.id}`,
      title: `Submitted Group "${grp.name}"`,
      desc: `Platform: ${grp.platform} • Status: ${grp.status.toUpperCase()}`,
      time: grp.createdAt,
      icon: Layers,
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60",
    });
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Account Activity</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit log of logins, profile modifications, group submissions, and security milestones
            </p>
          </div>
        </div>
      </div>

      {/* Timeline Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="space-y-6 relative before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {events.map((evt) => {
            const Icon = evt.icon;
            return (
              <div key={evt.id} className="relative flex items-start gap-4 group">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10 border border-slate-200 dark:border-slate-700 ${evt.color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex-1 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {evt.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatDate(evt.time)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{evt.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
