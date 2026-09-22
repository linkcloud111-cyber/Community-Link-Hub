import { useState, useEffect } from "react";
import { createContactMessage } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Mail, Phone, User, MessageSquare, Send, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { CharacterCounter } from "@/components/character-counter";
import { usePageTitle } from "@/lib/page-meta";
import { validateIndianMobile } from "@/lib/utils";

export default function ContactPage() {
  usePageTitle("Contact Webmaster", "Support & Inquiries");
  const { user, profile } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Prefill user data if logged in
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (phone.trim() && !validateIndianMobile(phone.trim())) {
      toast.error("Please enter a valid 10-digit Indian mobile number (6000000000 - 9999999999).");
      return;
    }

    if (message.trim().length < 20) {
      toast.error("Message must be at least 20 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await createContactMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      toast.success("Your message has been sent to the webmaster!");
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <PageBreadcrumb items={[{ label: "Contact Webmaster" }]} />

      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Support & Inquiries
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Contact Webmaster</h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Have a question, feedback, partnership request, or need help with a listing? Send a direct message to our support team.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-xl"
      >
        {submitted ? (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold">Message Sent Successfully</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Thank you for reaching out. The webmaster team will review your message and respond via email as soon as possible.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" /> Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" /> Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" /> Subject *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Listing Inquiry, Support, Bug Report"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                />
                <CharacterCounter current={subject.length} max={100} />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Message Content *
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                placeholder="Describe your message or request in detail (minimum 20 characters)..."
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition resize-none"
              />
              <CharacterCounter current={message.length} min={20} max={1000} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending Message...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Message</>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
