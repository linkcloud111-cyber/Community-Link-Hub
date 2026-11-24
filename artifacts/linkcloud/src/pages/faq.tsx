import { useState, useEffect, useMemo } from "react";
import { HelpCircle, ChevronDown, Search, MessageSquare, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { fetchPublicFaqs, usePublishedCmsPage } from "@/lib/cms-client";
import { usePageSEO } from "@/lib/page-meta";
import CmsBlockRenderer from "@/components/cms/CmsBlockRenderer";
import type { FAQItem } from "@/lib/types";

export default function FAQPage() {
  const { page, published, disabled, loading: pageLoading } = usePublishedCmsPage("faq");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [faqsLoading, setFaqsLoading] = useState(true);

  usePageSEO({
    title: disabled
      ? "FAQ Temporarily Unavailable"
      : published && page
      ? page.seo?.seoTitle || page.title
      : "Frequently Asked Questions",
    subtitle: published && page ? page.subtitle || "Help & Platform Answers" : "Help & Platform Answers",
    description:
      published && page
        ? page.seo?.seoDescription ||
          page.description ||
          "Find answers to common questions about discovering communities, submitting listings, and safety on LinkCloud."
        : "Find answers to common questions about discovering communities, submitting listings, and safety on LinkCloud.",
    keywords: published && page ? page.seo?.seoKeywords : undefined,
    canonicalPath: "/faq",
    canonicalUrl: published && page ? page.seo?.canonicalUrl : undefined,
    ogTitle: published && page ? page.seo?.ogTitle : undefined,
    ogDescription: published && page ? page.seo?.ogDescription : undefined,
    ogImage: published && page ? page.seo?.ogImage : undefined,
    noIndex: disabled
      ? true
      : published && page
      ? Boolean(page.seo?.noIndex)
      : pageLoading || faqsLoading || faqs.length === 0,
  });

  useEffect(() => {
    let active = true;
    setFaqsLoading(true);
    fetchPublicFaqs()
      .then((items) => {
        if (!active) return;
        setFaqs(items.filter((f) => f.enabled !== false && f.status !== "draft"));
      })
      .catch(() => {
        if (active) setFaqs([]);
      })
      .finally(() => {
        if (active) setFaqsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Authoritative Q&A entries come exclusively from the faqs/* collection (/api/faqs)
  const authoritativeFaqs = useMemo(() => {
    return faqs.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category || "General",
    }));
  }, [faqs]);

  // Render only non-Q&A CMS layout blocks (intro, notices, contact CTA) on /faq
  const pageLayoutBlocks = useMemo(() => {
    if (!published || !page?.blocks) return [];
    return page.blocks.filter((b) => b.type !== "faq_item");
  }, [published, page]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    authoritativeFaqs.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [authoritativeFaqs]);

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return authoritativeFaqs.filter((item) => {
      const catOk = selectedCategory === "ALL" || item.category === selectedCategory;
      const textOk =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [authoritativeFaqs, search, selectedCategory]);

  const isLoading = pageLoading && faqsLoading;

  if (!pageLoading && disabled) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        <div className="bg-card border border-border/80 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <HelpCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-extrabold tracking-tight">FAQ Temporarily Unavailable</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            This page has been temporarily disabled by the Webmaster. Please browse public communities or reach out through Contact Support.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/contact"
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition"
            >
              Contact Webmaster
            </Link>
            <Link
              href="/"
              className="px-5 py-2.5 bg-muted text-foreground font-semibold text-xs rounded-xl border border-border hover:bg-muted/80 transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Got Questions?
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          {published && page?.title ? page.title : "Frequently Asked Questions"}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {published && page?.description
            ? page.description
            : "Find answers to common questions about joining communities, submitting listings, and site safety."}
        </p>
      </div>

      {pageLayoutBlocks.length > 0 && (
        <div className="bg-card border border-border/80 rounded-3xl p-6 shadow-sm">
          <CmsBlockRenderer blocks={pageLayoutBlocks} compact />
        </div>
      )}

      {/* Search Input & Category Filters */}
      <div className="space-y-3">
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

        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {cat === "ALL" ? "All Categories" : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 bg-card border border-border rounded-3xl p-6 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs font-medium">Loading published FAQs...</p>
          </div>
        ) : authoritativeFaqs.length === 0 ? (
          <div className="text-center py-10 bg-card border border-border rounded-3xl p-6 space-y-2">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-1" />
            <p className="text-sm font-semibold">No FAQs are currently published.</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Published frequently asked questions from the Webmaster CMS will appear here automatically.
            </p>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="text-center py-10 bg-card border border-border rounded-3xl p-6">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold">No questions matched your search query.</p>
          </div>
        ) : (
          filteredFaqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.id}
                className="bg-card border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left font-bold text-sm sm:text-base flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1">
                    {faq.category && (
                      <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-primary">
                        {faq.category}
                      </span>
                    )}
                    <div className="text-foreground">{faq.question}</div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-3 whitespace-pre-line">
                    {faq.answer}
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
