import { useState } from "react";
import { Settings, Bell, Shield, Globe, Lock, Save, Check } from "lucide-react";
import { toast } from "sonner";
import type { UserProfile } from "@/lib/types";

interface SettingsTabProps {
  profile: UserProfile | null;
  onSavePreferences: (prefs: any) => Promise<void>;
}

export function SettingsTab({ profile, onSavePreferences }: SettingsTabProps) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [groupApprovalAlerts, setGroupApprovalAlerts] = useState(true);
  const [showPhonePublicly, setShowPhonePublicly] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSavePreferences({
        emailAlerts,
        groupApprovalAlerts,
        showPhonePublicly,
      });
      toast.success("Preferences updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">Account Settings</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Notification delivery, privacy controls, and communication options
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition shadow-sm self-start sm:self-auto flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>

      {/* Notifications Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Bell className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Email & Notification Preferences
          </h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer min-h-[56px] gap-4">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Group Approval & Status Notifications
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Receive instant emails when a Webmaster approves or rejects your submitted group.
              </p>
            </div>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
              <input
                type="checkbox"
                checked={groupApprovalAlerts}
                onChange={(e) => setGroupApprovalAlerts(e.target.checked)}
                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-600 cursor-pointer accent-purple-600"
              />
            </div>
          </label>

          <label className="flex items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer min-h-[56px] gap-4">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Security & Verification Alerts
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Important security notices regarding password resets, logins, and account reviews.
              </p>
            </div>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-600 cursor-pointer accent-purple-600"
              />
            </div>
          </label>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Shield className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Directory Privacy Controls
          </h3>
        </div>

        <label className="flex items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer min-h-[56px] gap-4">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Public Contact Visibility
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Display your verified mobile number on your submitted group directory cards.
            </p>
          </div>
          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
            <input
              type="checkbox"
              checked={showPhonePublicly}
              onChange={(e) => setShowPhonePublicly(e.target.checked)}
              className="w-5 h-5 rounded text-purple-600 focus:ring-purple-600 cursor-pointer accent-purple-600"
            />
          </div>
        </label>
      </div>
    </div>
  );
}
