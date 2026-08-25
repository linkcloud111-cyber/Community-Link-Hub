import { useState, useEffect } from "react";
import {
  broadcastAnnouncement,
  sendUserNotification,
  getAllNotificationsAdmin,
  deleteNotificationAdmin,
  getAllUsers,
} from "@/lib/firestore";
import type { Notification, UserProfile } from "@/lib/types";
import AdminNav from "@/components/admin-nav";
import { toast } from "sonner";
import {
  Loader2,
  Bell,
  Send,
  Trash2,
  Users,
  User,
  ShieldAlert,
  Megaphone,
} from "lucide-react";

export default function AdminNotifications() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcast Form
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Single User Form
  const [selectedUserUid, setSelectedUserUid] = useState("");
  const [userTitle, setUserTitle] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [sendingUserNotif, setSendingUserNotif] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, nList] = await Promise.all([getAllUsers(), getAllNotificationsAdmin()]);
      setUsers(uList);
      setNotifications(nList);
    } catch {
      toast.error("Failed to load notifications data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setSendingBroadcast(true);
    try {
      await broadcastAnnouncement(broadcastTitle, broadcastMessage);
      toast.success(`Broadcast announcement dispatched to all ${users.length} registered users`);
      setBroadcastTitle("");
      setBroadcastMessage("");
      await loadData();
    } catch {
      toast.error("Failed to send broadcast announcement");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleSendUserNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserUid || !userTitle.trim() || !userMessage.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSendingUserNotif(true);
    try {
      await sendUserNotification(selectedUserUid, userTitle, userMessage, "system");
      toast.success("Direct user notification sent");
      setUserTitle("");
      setUserMessage("");
      setSelectedUserUid("");
      await loadData();
    } catch {
      toast.error("Failed to send notification");
    } finally {
      setSendingUserNotif(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotificationAdmin(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification record removed");
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" /> Notifications & Broadcast Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispatch site-wide announcements or send individual alerts to specific community owners.
          </p>
        </div>
      </div>

      {/* Admin Nav */}
      <AdminNav />

      {/* Grid forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast Form */}
        <form onSubmit={handleSendBroadcast} className="bg-card border border-border p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Megaphone className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-base">Broadcast Site-Wide Announcement</h2>
          </div>

          <p className="text-xs text-muted-foreground">
            This message will be delivered to the notification bell inboxes of all <strong>{users.length} registered users</strong>.
          </p>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Announcement Title</label>
            <input
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="e.g. Site Maintenance Update or New Platform Addition"
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Announcement Content</label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Write clear announcement instructions..."
              className="w-full h-28 p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sendingBroadcast}
            className="w-full py-3 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            {sendingBroadcast ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Broadcast to All Users</>}
          </button>
        </form>

        {/* Direct User Notification Form */}
        <form onSubmit={handleSendUserNotif} className="bg-card border border-border p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <User className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-base">Send Direct User Alert</h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Target a specific registered account by name or email address.
          </p>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Select Recipient Account</label>
            <select
              value={selectedUserUid}
              onChange={(e) => setSelectedUserUid(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">-- Choose User Account --</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || "User"} ({u.email || u.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Notification Title</label>
            <input
              value={userTitle}
              onChange={(e) => setUserTitle(e.target.value)}
              placeholder="e.g. Account Notice or Group Resubmission Update"
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Notification Message</label>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Write direct message..."
              className="w-full h-20 p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sendingUserNotif}
            className="w-full py-3 bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            {sendingUserNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Direct Notification</>}
          </button>
        </form>
      </div>

      {/* Notifications History List */}
      <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
        <h2 className="font-bold text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Sent Notifications Log ({notifications.length})
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No notification history recorded yet.</p>
        ) : (
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{n.title}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary">
                      {n.type || "system"}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate">{n.message}</p>
                </div>

                <button
                  onClick={() => handleDeleteNotification(n.id)}
                  className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
