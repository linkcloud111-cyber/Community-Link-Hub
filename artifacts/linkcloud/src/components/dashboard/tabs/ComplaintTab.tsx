import { useState } from "react";
import { AlertOctagon, Send, Clock, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Complaint } from "@/lib/types";

interface ComplaintTabProps {
  complaints: Complaint[];
  onSubmitComplaint: (type: string, subject: string, description: string) => Promise<void>;
}

export function ComplaintTab({ complaints, onSubmitComplaint }: ComplaintTabProps) {
  const [complaintType, setComplaintType] = useState("Group Listing Issue");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Please fill in both Subject and Description.");
      return;
    }

    setLoading(true);
    try {
      await onSubmitComplaint(complaintType, subject.trim(), description.trim());
      setSubject("");
      setDescription("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit grievance.");
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
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Report a Problem & Grievance Redressal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submit formal grievances regarding unlawful groups, copyright, or platform bugs
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Submit New Grievance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Under Indian IT Rules 2021, all grievances are logged and reviewed by our designated officer.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Grievance Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
              >
                <option value="Group Listing Issue">Group Listing / Invite Issue</option>
                <option value="Prohibited or Fraudulent Content">Prohibited / Fraudulent Content</option>
                <option value="Copyright or Impersonation">Copyright or Impersonation</option>
                <option value="Account or Authentication Issue">Account or Security Issue</option>
                <option value="Other">Other Grievance</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue..."
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Detailed Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide specific URLs, timestamps, or details related to the grievance..."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !subject.trim() || !description.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting grievance...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Formal Grievance</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Submitted Grievances History (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              My Submitted Grievances
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Track resolution progress with tracking IDs
            </p>

            {complaints.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-400">
                No active complaints filed.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {complaints.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {c.subject}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold flex-shrink-0">
                        {c.status || "FILED"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {c.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span className="font-mono">{c.ticketNumber || c.id.slice(0, 8)}</span>
                      <span>{formatDate(c.createdAt)}</span>
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
