import { useEffect, useState } from "react";
import { HelpCircle, CheckCircle2, Mail, Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { DashboardTab } from "@/hooks/useDashboardTabs";
import { fetchPublicFaqs } from "@/lib/cms-client";
import type { FAQItem } from "@/lib/types";

interface HelpTabProps {
  onNavigate: (tab: DashboardTab) => void;
}

export function HelpTab({ onNavigate }: HelpTabProps) {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPublicFaqs()
      .then((items) => {
        if (!active) return;
        setFaqs(items.filter((f) => f.enabled !== false && f.status !== "draft"));
      })
      .catch(() => {
        if (active) setFaqs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Help Center & FAQ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live guidance for group submissions, safety rules, and platform policies
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/faq"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            All FAQs <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Help Guides <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Live FAQs from Authoritative FAQ Management */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
          Frequently Asked Questions
        </h3>

        {loading ? (
          <div className="py-8 flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            <span className="text-xs">Loading live FAQs...</span>
          </div>
        ) : faqs.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 text-center space-y-1.5">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              No published FAQs available right now.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Browse the Help Center or reach out to our support desk below.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                    <span>{faq.question}</span>
                  </h4>
                  {faq.category && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                      {faq.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-5 leading-relaxed whitespace-pre-line">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        )}
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
