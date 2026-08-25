import { Bell, CheckCheck, Trash2, Shield, Info, CheckCircle2, Clock } from "lucide-react";
import type { Notification } from "@/lib/types";

interface NotificationsTabProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
}

export function NotificationsTab({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
}: NotificationsTabProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
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
      return "N/A";
    }
  };

  const getCategoryIcon = (type?: string) => {
    switch (type) {
      case "security":
      case "account":
        return <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "group_approved":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Notifications & Activity Alerts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              System alerts, group approval notices, and security updates
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 transition self-start sm:self-auto"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No notifications yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              You are completely up to date! System messages, group status updates, and security notices will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.read && onMarkRead(notif.id)}
              className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition cursor-pointer ${
                notif.read
                  ? "bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  : "bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50/70"
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getCategoryIcon(notif.type)}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm tracking-tight truncate ${
                        notif.read
                          ? "font-semibold text-slate-800 dark:text-slate-200"
                          : "font-bold text-slate-900 dark:text-white"
                      }`}
                    >
                      {notif.title}
                    </h4>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(notif.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNotification(notif.id);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Delete notification"
                  aria-label="Delete notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
