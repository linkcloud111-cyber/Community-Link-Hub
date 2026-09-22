import { useState, useEffect } from "react";
import { createComplaint } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertCircle,
  User,
  Mail,
  Phone,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  ShieldAlert,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { CharacterCounter } from "@/components/character-counter";
import { usePageTitle } from "@/lib/page-meta";
import { validateIndianMobile } from "@/lib/utils";

export default function ComplaintPage() {
  usePageTitle("Submit a Grievance", "Public Grievance Desk");
  const { user, profile } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [complaintRefNumber, setComplaintRefNumber] = useState("");
  const [copiedRef, setCopiedRef] = useState(false);

  // Prefill user info if logged in
  useEffect(() => {
    if (user || profile) {
      if (profile?.displayName || user?.displayName) {
        setName((prev) => prev || profile?.displayName || user?.displayName || "");
      }
      if (profile?.email || user?.email) {
        setEmail((prev) => prev || profile?.email || user?.email || "");
      }
      if (profile?.mobile) {
        setPhone((prev) => prev || profile.mobile);
      }
    }
  }, [user, profile]);

  const handleCopyRef = async () => {
    if (!complaintRefNumber) return;
    await navigator.clipboard.writeText(complaintRefNumber);
    setCopiedRef(true);
    toast.success("Grievance Reference Number copied to clipboard.");
    setTimeout(() => setCopiedRef(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !subject.trim() || !message.trim()) {
      toast.error("Please fill in all required complaint fields.");
      return;
    }

    if (!validateIndianMobile(phone.trim())) {
      toast.error("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      return;
    }

    if (message.trim().length < 20) {
      toast.error("Grievance description must be at least 20 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      const refId = await createComplaint({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setComplaintRefNumber(refId || `GRV-${Date.now().toString().slice(-8)}`);
      toast.success("Complaint registered successfully.");
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Failed to submit complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <PageBreadcrumb items={[{ label: "Grievance Desk" }]} />

      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" /> Official Grievance Desk
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Submit a Grievance</h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Report copyright infringement, unlawful content, unauthorized listings, or community violations under our Public Listing Policies.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-xl"
      >
        {submitted ? (
          <div className="text-center space-y-6 py-6">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Grievance Registered Successfully</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your report has been logged in the LinkCloud Grievance Redressal system. Our compliance team will review the claim within 48 business hours.
              </p>
            </div>

            {/* Official Reference Token Box */}
            <div className="p-4 bg-muted/60 border border-border rounded-2xl max-w-md mx-auto space-y-2 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Grievance Reference Number
              </div>
              <div className="flex items-center justify-between gap-3 bg-background p-3 rounded-xl border border-border font-mono text-sm font-bold text-foreground">
                <span className="truncate">{complaintRefNumber}</span>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground flex-shrink-0"
                  title="Copy reference number"
                >
                  {copiedRef ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Save this reference number for all future tracking and correspondence regarding this claim.
              </p>
            </div>

            <button
              onClick={() => {
                setSubmitted(false);
                setComplaintRefNumber("");
              }}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition cursor-pointer"
            >
              Submit Another Grievance
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-destructive" /> Complainant Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Legal Name"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-destructive outline-none transition"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-destructive" /> Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-destructive outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-destructive" /> Mobile Number (India) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  maxLength={10}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-destructive outline-none transition"
                />
                <span className="text-[10px] text-muted-foreground">Standard 10-digit Indian mobile number</span>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-destructive" /> Nature of Grievance *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Copyright Infringement, Harassment, Fraud"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-destructive outline-none transition"
                />
                <CharacterCounter current={subject.length} max={100} />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Detailed Statement & Evidence Links *
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1500}
                placeholder="State specific details, link to the community on LinkCloud, timestamps, and basis of grievance (minimum 20 characters)..."
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-destructive outline-none transition resize-none"
              />
              <CharacterCounter current={message.length} min={20} max={1500} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-destructive text-destructive-foreground font-bold rounded-xl text-sm hover:bg-destructive/90 transition shadow-lg shadow-destructive/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Grievance...</>
              ) : (
                <><Send className="w-4 h-4" /> File Grievance</>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
