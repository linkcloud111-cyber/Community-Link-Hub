import { useState, useEffect, useMemo } from "react";
import { BookOpen, Search, MessageSquare, HelpCircle, Loader2, ListChecks } from "lucide-react";
import { Link } from "wouter";
import { fetchPublicHelpArticles, usePublishedCmsPage } from "@/lib/cms-client";
import { usePageSEO } from "@/lib/page-meta";
import CmsBlockRenderer from "@/components/cms/CmsBlockRenderer";
import type { HelpArticle } from "@/lib/types";

export default function HelpPage() {
  const { page, published, disabled, loading: pageLoading } = usePublishedCmsPage("help");
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  usePageSEO({
    title: disabled
      ? "Help Center Temporarily Unavailable"
      : published && page
      ? page.seo?.seoTitle || page.title
      : "Help Center",
    subtitle: published && page ? page.subtitle || "Guides & Support Articles" : "Guides & Support Articles",
    description:
      published && page
        ? page.seo?.seoDescription ||
          page.description ||
          "Browse LinkCloud Help Center guides, safety instructions, and submission walkthroughs."
        : "Browse LinkCloud Help Center guides, safety instructions, and submission walkthroughs.",
    keywords: published && page ? page.seo?.seoKeywords : undefined,
    canonicalPath: "/help",
    canonicalUrl: published && page ? page.seo?.canonicalUrl : undefined,
    ogTitle: published && page ? page.seo?.ogTitle : undefined,
    ogDescription: published && page ? page.seo?.ogDescription : undefined,
    ogImage: published && page ? page.seo?.ogImage : undefined,
    noIndex: disabled
      ? true
      : published && page
      ? Boolean(page.seo?.noIndex)
      : pageLoading || articlesLoading || articles.length === 0,
  });

  useEffect(() => {
    let active = true;
    setArticlesLoading(true);
    fetchPublicHelpArticles()
      .then((items) => {
        if (!active) return;
        setArticles(items.filter((a) => a.enabled !== false && a.status !== "draft"));
      })
      .catch(() => {
        if (active) setArticles([]);
      })
      .finally(() => {
        if (active) setArticlesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((art) => {
      const catOk = selectedCategory === "ALL" || art.category === selectedCategory;
      const stepsMatch = Array.isArray(art.steps)
        ? art.steps.some((s) => s.toLowerCase().includes(q))
        : false;
      const textOk =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.content.toLowerCase().includes(q) ||
        (art.category || "").toLowerCase().includes(q) ||
        stepsMatch;
      return catOk && textOk;
    });
  }, [articles, search, selectedCategory]);

  const hasCmsBlocks = Boolean(published && page && Array.isArray(page.blocks) && page.blocks.length > 0);
  const isLoading = pageLoading && articlesLoading;

  if (!pageLoading && disabled) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        <div className="bg-card border border-border/80 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <BookOpen className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-extrabold tracking-tight">Help Center Temporarily Unavailable</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The Help Center is currently disabled by the Webmaster. Please reach out via Contact Support if you need assistance.
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
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Help Center
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          {published && page?.title ? page.title : "How Can We Help You?"}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          {published && page?.description
            ? page.description
            : "Guides, instructions, and assistance for discovering communities, submitting listings, and reporting issues on LinkCloud."}
        </p>
      </div>

      {/* Published CMS Overview & Walkthrough Blocks */}
      {hasCmsBlocks && page && (
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          <CmsBlockRenderer blocks={page.blocks} />
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help articles, categories, or step guides..."
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
                {cat === "ALL" ? "All Topics" : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Help Articles from CMS Knowledgebase */}
      {isLoading ? (
        <div className="text-center py-12 bg-card border border-border/80 rounded-3xl p-6 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs font-medium">Loading Help Center guides...</p>
        </div>
      ) : filteredArticles.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Help Guides & Knowledgebase
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredArticles.map((art) => (
              <article
                key={art.id}
                className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <span className="inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {art.category || "General"}
                  </span>
                  <h3 className="font-bold text-base text-foreground">{art.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {art.content}
                  </p>

                  {Array.isArray(art.steps) && art.steps.length > 0 && (
                    <div className="pt-2 space-y-2 border-t border-border/50">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-primary" /> Step-by-step instructions
                      </p>
                      <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
                        {art.steps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : !hasCmsBlocks ? (
        <div className="text-center py-12 bg-card border border-border/80 rounded-3xl p-6 space-y-2">
          <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">
            {articles.length === 0
              ? "Help Center articles are not yet published."
              : "No Help Center articles matched your search."}
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {articles.length === 0
              ? "Once published by the Webmaster, step-by-step guides and knowledgebase articles will appear here."
              : "Try clearing your search or selecting another category."}
          </p>
        </div>
      ) : null}

      <div className="bg-card border border-border/80 rounded-3xl p-8 text-center space-y-4">
        <h3 className="text-xl font-bold">Need Personal Assistance?</h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Our support desk is ready to answer your questions and assist with community listings.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition"
          >
            <MessageSquare className="w-4 h-4" /> Contact Webmaster Desk
          </Link>
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 px-6 py-3 bg-muted text-foreground border border-border font-bold text-sm rounded-xl hover:bg-muted/80 transition"
          >
            <HelpCircle className="w-4 h-4" /> Browse FAQs
          </Link>
        </div>
      </div>
    </div>
  );
}
