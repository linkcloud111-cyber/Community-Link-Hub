import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { createReport } from "@/lib/firestore";
import {
  REPORT_REASONS,
  validateReportPayload,
  MIN_REPORT_DETAILS_LENGTH,
  MAX_REPORT_DETAILS_LENGTH,
} from "@/lib/group-validation";
import { toast } from "sonner";
import { X, ShieldAlert, Loader2, AlertCircle } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

const REPORT_COOLDOWN_MS = 10 * 60 * 1000;

export default function ReportModal({ isOpen, onClose, groupId, groupName }: ReportModalProps) {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    reporterName?: string;
    reason?: string;
    details?: string;
    general?: string;
  }>({});

  useEffect(() => {
    if (!isOpen) {
      setFieldErrors({});
      setSubmitting(false);
    }
  }, [isOpen, groupId]);

  if (!isOpen || settings?.reportSystemEnabled === false) return null;

  const trimmedDetailsLen = details.trim().length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (settings?.reportSystemEnabled === false) {
      toast.error("Abuse reporting is currently disabled by the webmaster.");
      onClose();
      return;
    }

    const storageKey = `lc_report_sent_${groupId}`;
    if (typeof window !== "undefined") {
      try {
        const lastSent = Number(window.sessionStorage.getItem(storageKey) || "0");
        if (lastSent && Date.now() - lastSent < REPORT_COOLDOWN_MS) {
          const msg = "You have already reported this community recently. Please wait before submitting again.";
          setFieldErrors({ general: msg });
          toast.error(msg);
          return;
        }
      } catch {}
    }

    const validation = validateReportPayload({
      isSignedIn: Boolean(user),
      reporterName: user ? profile?.displayName || user.displayName || "Registered Member" : reporterName,
      reason,
      details,
    });

    if (!validation.valid) {
      setFieldErrors(validation.errors);
      const firstError =
        validation.errors.reporterName ||
        validation.errors.reason ||
        validation.errors.details ||
        "Please complete all required fields.";
      toast.error(firstError);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await createReport({
        groupId,
        groupName,
        reportedBy: user?.uid || "",
        reportedByName: validation.cleanData.reporterName,
        reason: validation.cleanData.reason,
        details: validation.cleanData.details,
      });

      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(storageKey, String(Date.now()));
        } catch {}
      }

      toast.success("Report submitted. Thank you for keeping LinkCloud safe.");
      setDetails("");
      setReason("");
      setReporterName("");
      setFieldErrors({});
      onClose();
    } catch (err: any) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      } else {
        setFieldErrors({ general: err?.message || "Failed to submit report. Please try again." });
      }
      toast.error(err?.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" /> Report Issue
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close report modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Reporting: <span className="font-medium text-foreground">{groupName}</span>
        </p>

        {fieldErrors.general && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{fieldErrors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Show mandatory name field for unauthenticated visitors */}
          {!user && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Your Name <span className="text-destructive">*</span>
              </label>
              <input
                required
                value={reporterName}
                maxLength={100}
                onChange={(e) => {
                  setReporterName(e.target.value);
                  if (fieldErrors.reporterName) {
                    setFieldErrors((prev) => ({ ...prev, reporterName: undefined }));
                  }
                }}
                className={`w-full px-3 py-2.5 bg-background border rounded-xl text-sm focus:ring-2 outline-none transition ${
                  fieldErrors.reporterName
                    ? "border-destructive focus:ring-destructive"
                    : "border-border focus:ring-primary"
                }`}
                placeholder="Enter your full name"
              />
              {fieldErrors.reporterName && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {fieldErrors.reporterName}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (fieldErrors.reason) {
                  setFieldErrors((prev) => ({ ...prev, reason: undefined }));
                }
              }}
              className={`w-full px-3 py-2.5 bg-background border rounded-xl text-sm focus:ring-2 outline-none transition cursor-pointer ${
                fieldErrors.reason
                  ? "border-destructive focus:ring-destructive"
                  : "border-border focus:ring-primary"
              }`}
              required
            >
              <option value="">Select a reason...</option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {fieldErrors.reason && (
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {fieldErrors.reason}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Issue Details <span className="text-destructive">*</span>
              </label>
              <span
                className={`text-xs font-semibold ${
                  trimmedDetailsLen > MAX_REPORT_DETAILS_LENGTH
                    ? "text-destructive"
                    : trimmedDetailsLen < MIN_REPORT_DETAILS_LENGTH
                    ? "text-muted-foreground"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {trimmedDetailsLen} / {MAX_REPORT_DETAILS_LENGTH}
              </span>
            </div>
            <textarea
              rows={3}
              required
              minLength={MIN_REPORT_DETAILS_LENGTH}
              maxLength={MAX_REPORT_DETAILS_LENGTH}
              value={details}
              onChange={(e) => {
                setDetails(e.target.value);
                if (fieldErrors.details) {
                  setFieldErrors((prev) => ({ ...prev, details: undefined }));
                }
              }}
              className={`w-full px-3 py-2.5 bg-background border rounded-xl text-sm focus:ring-2 outline-none transition resize-none ${
                fieldErrors.details
                  ? "border-destructive focus:ring-destructive"
                  : "border-border focus:ring-primary"
              }`}
              placeholder="Describe the issue clearly (minimum 10 characters)..."
            />
            {fieldErrors.details ? (
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {fieldErrors.details}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Minimum {MIN_REPORT_DETAILS_LENGTH} characters, maximum {MAX_REPORT_DETAILS_LENGTH} characters. No attachments needed.
              </p>
            )}
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
              className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
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
