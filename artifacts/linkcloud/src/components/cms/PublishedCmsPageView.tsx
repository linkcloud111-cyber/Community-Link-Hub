import { Link } from "wouter";
import { AlertCircle, ArrowLeft, FileText, Loader2, MessageSquare, ShieldAlert } from "lucide-react";
import type { CmsPageSlug } from "@/lib/types";
import { usePublishedCmsPage } from "@/lib/cms-client";
import { usePageSEO } from "@/lib/page-meta";
import CmsBlockRenderer from "@/components/cms/CmsBlockRenderer";

interface PublishedCmsPageViewProps {
  slug: CmsPageSlug;
  badgeLabel: string;
  badgeTone?: "primary" | "destructive" | "amber";
  defaultTitle: string;
  defaultSubtitle: string;
  defaultDescription: string;
  canonicalPath: string;
  unavailableTitle?: string;
  unavailableMessage?: string;
  footerAction?: {
    href: string;
    label: string;
  };
}

function formatCmsDate(iso?: string): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PublishedCmsPageView({
  slug,
  badgeLabel,
  badgeTone = "primary",
  defaultTitle,
  defaultSubtitle,
  defaultDescription,
  canonicalPath,
  unavailableTitle = "Page Pending Review",
  unavailableMessage = "This page is currently unpublished or undergoing Webmaster review. Please check back soon or contact our support desk if you need assistance.",
  footerAction,
}: PublishedCmsPageViewProps) {
  const { page, published, loading } = usePublishedCmsPage(slug);

  usePageSEO({
    title: published && page ? page.seo?.seoTitle || page.title : defaultTitle,
    subtitle: published && page ? page.subtitle || defaultSubtitle : defaultSubtitle,
    description:
      published && page
        ? page.seo?.seoDescription || page.description || defaultDescription
        : defaultDescription,
    keywords: published && page ? page.seo?.seoKeywords : undefined,
    canonicalPath,
    canonicalUrl: published && page ? page.seo?.canonicalUrl : undefined,
    ogTitle: published && page ? page.seo?.ogTitle : undefined,
    ogDescription: published && page ? page.seo?.ogDescription : undefined,
    ogImage: published && page ? page.seo?.ogImage : undefined,
    noIndex: published && page ? Boolean(page.seo?.noIndex) : true,
  });

  const badgeClass =
    badgeTone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : badgeTone === "amber"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-primary/10 text-primary";

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-xs font-medium">Loading {defaultTitle}...</p>
      </div>
    );
  }

  if (!published || !page) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        <div className="space-y-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${badgeClass}`}
          >
            <FileText className="w-3.5 h-3.5" /> {badgeLabel}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{defaultTitle}</h1>
        </div>

        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">{unavailableTitle}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {unavailableMessage}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Contact Support
            </Link>
            <Link
              href="/complaint"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground border border-border text-xs font-bold hover:bg-muted/80 transition"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Submit Complaint
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-transparent text-muted-foreground text-xs font-semibold hover:text-foreground transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lastUpdated = formatCmsDate(page.lastPublishedAt || page.updatedAt);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-3">
        <span
          className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${badgeClass}`}
        >
          {badgeLabel}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{page.title}</h1>
        {page.subtitle && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {page.subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {lastUpdated && <span>Last published: {lastUpdated}</span>}
          {page.version ? <span>• Version {page.version}</span> : null}
        </div>
      </div>

      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
        {page.description && (
          <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed border-b border-border/50 pb-5">
            {page.description}
          </p>
        )}

        <CmsBlockRenderer blocks={page.blocks} />

        {footerAction && (
          <div className="pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={footerAction.href}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition"
            >
              {footerAction.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
