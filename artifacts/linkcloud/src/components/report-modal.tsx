import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createReport } from "@/lib/firestore";
import { toast } from "sonner";
import { X, ShieldAlert, Loader2 } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

const REPORT_REASONS = [
  "Invalid Link",
  "Spam",
  "Scam",
  "Fake Group",
  "Adult Content",
  "Duplicate",
  "Copyright",
  "Other",
];

export default function ReportModal({ isOpen, onClose, groupId, groupName }: ReportModalProps) {
  const { user, profile } = useAuth();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [reporterName, setReporterName] = useState(profile?.displayName || "");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    const nameToUse = user
      ? profile?.displayName || user.displayName || user.email || "Anonymous"
      : reporterName.trim() || "Anonymous";

    setSubmitting(true);
    try {
      await createReport({
        groupId,
        groupName,
        reportedBy: user?.uid || "",
        reportedByName: nameToUse,
        reason,
        details: details.trim(),
      });
      toast.success("Report submitted. Thank you for keeping LinkCloud safe.");
      setDetails("");
      setReason(REPORT_REASONS[0]);
      onClose();
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" /> Report Issue
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Reporting: <span className="font-medium text-foreground">{groupName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Show name field only for anonymous users */}
          {!user && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your Name (optional)</label>
              <input
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                placeholder="Anonymous"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition cursor-pointer"
              required
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Additional Details (optional)</label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition resize-none"
              placeholder="Provide more context about the issue..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                "Submit Report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
