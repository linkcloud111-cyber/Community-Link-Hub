import React, { useState } from "react";
import {
  Mail,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Send,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface EmailVerificationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string | null;
  isEmailVerified: boolean;
  pendingEmail?: string | null;
  displayName?: string;
  accountUid?: string;
  onResend?: () => Promise<void>;
  resending?: boolean;
  cooldown?: number;
}

export function EmailVerificationPreviewModal({
  isOpen,
  onClose,
  email,
  isEmailVerified,
  pendingEmail,
  displayName = "Member",
  accountUid,
  onResend,
  resending = false,
  cooldown = 0,
}: EmailVerificationPreviewModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const targetEmail = pendingEmail || email || "user@example.com";
  const dummyVerificationLink = `https://linkcloud.in/verify-handler?mode=verifyEmail&uid=${accountUid || "usr_sample"}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(dummyVerificationLink);
    setCopiedLink(true);
    toast.success("Sample verification link copied to clipboard");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      id="lc_email_preview_modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-preview-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id="email-preview-title"
                  className="text-base font-bold text-slate-900 dark:text-white truncate"
                >
                  Verification Email Preview
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  Email Client Mockup
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Preview the exact verification email sent to your inbox
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content / Email Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Email Envelope Info Box */}
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3.5 space-y-1.5 text-xs font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-sans">
                <span className="font-semibold text-slate-900 dark:text-white">From:</span>
                <span>LinkCloud Security</span>
                <span className="text-slate-400">&lt;noreply@linkcloud.in&gt;</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-sans text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Sender (SPF/DKIM Signed)</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-sans">
              <span className="font-semibold text-slate-900 dark:text-white">To:</span>
              <span className="text-purple-600 dark:text-purple-400 font-medium">{targetEmail}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-sans">
              <span className="font-semibold text-slate-900 dark:text-white">Subject:</span>
              <span className="text-slate-900 dark:text-white font-medium">
                Verify your email address for LinkCloud Directory
              </span>
            </div>
          </div>

          {/* Email Body Canvas */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 p-6 sm:p-8 space-y-6 shadow-sm">
            {/* Branded Email Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  LC
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">LinkCloud</h4>
                  <p className="text-[10px] text-slate-400">Community Directory</p>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span>Expires in 10 mins</span>
              </div>
            </div>

            {/* Email Message Content */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Verify your email address
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Hello <strong>{displayName}</strong>,
              </p>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Thank you for choosing LinkCloud. To confirm your account, safeguard your profile, and enable instant group publishing across WhatsApp and Telegram directories, please verify your email address below.
              </p>

              {/* Call to Action Button */}
              <div className="py-2 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => {
                    toast.info("In the actual email, clicking this button instantly verifies your email address.");
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-600/20 transition cursor-pointer"
                >
                  <span>Verify Email Address</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Expiration Note */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Security Expiration Notice</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    This verification link remains valid for <strong>10 minutes</strong>. If you did not request this email, no further action is needed and your account remains safe.
                  </p>
                </div>
              </div>

              {/* Plain text link backup */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Button not working? Copy and paste this fallback link into your browser:
                </p>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-[11px] font-mono text-purple-600 dark:text-purple-400 break-all">
                  <span className="flex-1 truncate">{dummyVerificationLink}</span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition flex-shrink-0"
                    title="Copy Link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Email Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 space-y-1 text-center sm:text-left">
              <p>© 2026 LinkCloud Directory • India&apos;s Community Network</p>
              <p>Security Reference: LC-SEC-VERIFY-{accountUid || "TOKEN"}</p>
            </div>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isEmailVerified ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span>
              Status: {isEmailVerified ? "Email is currently verified" : "Verification pending"}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {onResend && (
              <button
                type="button"
                onClick={onResend}
                disabled={resending || cooldown > 0}
                className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition shadow-sm"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Resend in {cooldown}s</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Resend Live Email</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
