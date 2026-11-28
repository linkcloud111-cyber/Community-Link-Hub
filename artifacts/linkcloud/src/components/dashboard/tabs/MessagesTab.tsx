import { useState } from "react";
import { MessageSquare, Send, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import type { ContactMessage } from "@/lib/types";

interface MessagesTabProps {
  messages: ContactMessage[];
  onSendMessage: (subject: string, message: string) => Promise<void>;
}

export function MessagesTab({ messages, onSendMessage }: MessagesTabProps) {
  const { settings } = useSiteSettings();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const contactEnabled = settings?.contactFormEnabled !== false;
  const visibleContactEmail =
    settings?.showCompleteContactSection !== false &&
    settings?.showSupportEmail !== false &&
    settings?.showContactEmail !== false
      ? settings?.contactEmail
      : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEnabled) {
      toast.error("Contact support form is currently paused by the webmaster.");
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both Subject and Message.");
      return;
    }
    if (message.trim().length < 20) {
      toast.error("Message must be at least 20 characters long.");
      return;
    }

    setLoading(true);
    try {
      await onSendMessage(subject.trim(), message.trim());
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Contact Webmaster & Support
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct inquiries, listing assistance, and administrative inquiries
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Send Inquiry Form (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Send New Message
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Our Webmaster team typically responds within 24-48 hours.
          </p>

          {!contactEnabled ? (
            <div className="p-6 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Contact Support Form Temporarily Paused
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Direct form submissions are currently paused by the webmaster.
                {visibleContactEmail ? ` You may reach us at ${visibleContactEmail}.` : ""}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Question regarding Telegram group approval"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Message Content <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-medium ${message.trim().length < 20 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {message.trim().length}/1000 (min 20)
                  </span>
                </div>
                <textarea
                  required
                  rows={5}
                  minLength={20}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your inquiry with as much detail as possible (minimum 20 characters)..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !subject.trim() || message.trim().length < 20}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending message...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message to Webmaster</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Message History (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Previous Inquiries
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Your logged contact requests and review statuses
            </p>

            {messages.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-400">
                No past messages found.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {msg.subject}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex-shrink-0">
                        {msg.status || "RECEIVED"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {msg.message}
                    </p>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(msg.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
