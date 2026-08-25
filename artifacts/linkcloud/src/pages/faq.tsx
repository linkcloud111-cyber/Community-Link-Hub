import { useState, useEffect } from "react";
import { HelpCircle, ChevronDown, Search, MessageSquare, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { getFAQs } from "@/lib/firestore";
import type { FAQItem } from "@/lib/types";

const DEFAULT_FAQS = [
  {
    q: "Is LinkCloud free to use?",
    a: "Yes! Visitors can freely browse, search, copy invite links, and join communities without paying any fee or even registering an account.",
  },
  {
    q: "Do I need an account to browse or join communities?",
    a: "No. Visitors can discover and join all approved groups directly. Creating an account is only required if you want to submit your own communities or manage listings.",
  },
  {
    q: "How do community approvals work?",
    a: "When a user submits a group link, our Webmaster verifies the group name, description, rules, and invite link validity. Once approved, it appears in public search results.",
  },
  {
    q: "What should I do if an invite link is broken or invalid?",
    a: "On any group details page or card, click 'Report Group' and select 'Invalid Link'. Our system will flag the listing for re-verification.",
  },
  {
    q: "Which messaging platforms are supported on LinkCloud?",
    a: "We support WhatsApp, Telegram, Discord, Facebook Groups, Instagram Broadcast Channels, X (Twitter) Communities, LinkedIn Groups, YouTube Channels, and Reddit.",
  },
  {
    q: "How can I remove my community listing from LinkCloud?",
    a: "If you listed the group from your account, you can edit or delete it from your User Dashboard. Alternatively, contact the webmaster or submit a removal request via our Complaint form.",
  },
  {
    q: "How do I report spam, fake groups, or inappropriate content?",
    a: "You can click 'Report Group' on the community details page, or use our official Complaint page. Reports are processed by the Webmaster within 24 hours.",
  },
];

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>(DEFAULT_FAQS);

  useEffect(() => {
    getFAQs().then((items: FAQItem[]) => {
      if (items && items.length > 0) {
        const dynamicFaqs = items.map((f) => ({ q: f.question, a: f.answer }));
        // Combine dynamic firestore FAQs with default FAQs
        setFaqs([...dynamicFaqs, ...DEFAULT_FAQS]);
      }
    }).catch(console.error);
  }, []);

  const filteredFaqs = faqs.filter(
    (item) =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Got Questions?
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Frequently Asked Questions</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Find answers to common questions about joining communities, submitting listings, and site safety.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions or keywords..."
          className="w-full pl-12 pr-4 py-3.5 bg-card border border-border/80 rounded-2xl text-sm focus:ring-2 focus:ring-primary outline-none transition shadow-sm"
        />
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-10 bg-card border border-border rounded-3xl p-6">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold">No questions matched your search query.</p>
          </div>
        ) : (
          filteredFaqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-card border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left font-bold text-sm sm:text-base flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Contact Card */}
      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 text-center space-y-4">
        <h3 className="text-lg font-bold">Still have questions?</h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          If you couldn't find the answer to your question, feel free to contact our webmaster support desk.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/contact"
            className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" /> Contact Webmaster
          </Link>
          <Link
            href="/complaint"
            className="px-5 py-2.5 bg-muted text-foreground font-semibold text-xs rounded-xl hover:bg-muted/80 transition flex items-center gap-2 border border-border"
          >
            Submit Complaint <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
