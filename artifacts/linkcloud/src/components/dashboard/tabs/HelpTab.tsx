import { HelpCircle, ChevronDown, CheckCircle2, ShieldCheck, Mail, Plus } from "lucide-react";
import { Link } from "wouter";
import type { DashboardTab } from "@/hooks/useDashboardTabs";

interface HelpTabProps {
  onNavigate: (tab: DashboardTab) => void;
}

export function HelpTab({ onNavigate }: HelpTabProps) {
  const faqs = [
    {
      q: "How long does it take for a submitted group to get approved?",
      a: "Our Webmaster team reviews all submissions within 24 to 48 hours to ensure compliance with our community guidelines and Indian cyber regulations.",
    },
    {
      q: "Why was my group rejected?",
      a: "Common reasons include expired invite links, prohibited or adult content, misleading descriptions, or duplicate submissions. You can check specific feedback on your My Groups tab.",
    },
    {
      q: "How does the account deletion lifecycle work?",
      a: "When you submit an account deletion request, it enters PENDING review by the Webmaster. Once approved, all your private profile data is permanently purged. If rejected, a 7-day cooldown applies before a new request can be submitted.",
    },
    {
      q: "How do I verify my Indian mobile number?",
      a: "Go to your Profile tab or Account Security tab and click 'Link Mobile'. Enter your 10-digit number to complete verification.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Help Center & FAQ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Guidance for group submissions, safety rules, and platform policies
            </p>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
          Frequently Asked Questions
        </h3>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5"
            >
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                <span>{faq.q}</span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 pl-5.5 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base font-bold">Still have questions or need assistance?</h3>
          <p className="text-xs text-purple-200 max-w-lg">
            Our Webmaster support desk is available to assist you with any inquiries or group issues.
          </p>
        </div>

        <button
          onClick={() => onNavigate("messages")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-purple-900 hover:bg-purple-50 transition shadow flex-shrink-0"
        >
          <Mail className="w-4 h-4" />
          <span>Contact Webmaster</span>
        </button>
      </div>
    </div>
  );
}
