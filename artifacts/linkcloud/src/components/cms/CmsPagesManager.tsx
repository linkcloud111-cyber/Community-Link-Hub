import { useState } from "react";
import type { User } from "firebase/auth";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type {
  CmsAutoSeedResponse,
  CmsPageAdminOverview,
  CmsPageHealthStatus,
  CmsPageSlug,
} from "@/lib/types";
import {
  CMS_PAGE_DEFAULT_ORDER,
  CMS_PAGE_LABELS,
  hasUnreviewedLegalDraftCopy,
} from "@/lib/cms-schema";
import { adminRunCmsAutoSeed, adminRunCmsRefresh } from "@/lib/cms-client";

interface CmsPagesManagerProps {
  pages: CmsPageAdminOverview[];
  loading: boolean;
  user: User | null;
  filterSlugs?: CmsPageSlug[];
  title?: string;
  subtitle?: string;
  onEditPage: (overview: CmsPageAdminOverview) => void;
  onRefreshState: () => Promise<void> | void;
}

const HEALTH_BADGE: Record<
  CmsPageHealthStatus,
  { label: string; classes: string }
> = {
  published: {
    label: "Published",
    classes: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  draft: {
    label: "Draft Only",
    classes: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  },
  incomplete: {
    label: "Incomplete Placeholder",
    classes: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  },
  missing: {
    label: "Missing CMS Record",
    classes: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  },
  error: {
    label: "Error",
    classes: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export default function CmsPagesManager({
  pages,
  loading,
  user,
  filterSlugs,
  title = "Public Pages CMS Manager",
  subtitle = "Manage structured sections, drafts, version history, SEO metadata, and live publishing across LinkCloud's 7 public pages.",
  onEditPage,
  onRefreshState,
}: CmsPagesManagerProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [dryRunPlan, setDryRunPlan] = useState<CmsAutoSeedResponse | null>(null);

  const visiblePages = (filterSlugs
    ? pages.filter((p) => filterSlugs.includes(p.slug))
    : pages
  )
    .slice()
    .sort((a, b) => {
      const aDoc = a.published || a.draft;
      const bDoc = b.published || b.draft;
      const aOrd = Number.isFinite(Number(aDoc?.displayOrder))
        ? Number(aDoc?.displayOrder)
        : CMS_PAGE_DEFAULT_ORDER[a.slug];
      const bOrd = Number.isFinite(Number(bDoc?.displayOrder))
        ? Number(bDoc?.displayOrder)
        : CMS_PAGE_DEFAULT_ORDER[b.slug];
      return aOrd - bOrd;
    });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await adminRunCmsRefresh(user);
      toast.success(
        `Refreshed CMS status: ${res.summary.published} published, ${res.summary.draft} draft, ${res.summary.incomplete + res.summary.missing} needing setup`
      );
      await onRefreshState();
    } catch (err: any) {
      toast.error(err?.message || "Failed to refresh CMS status");
    } finally {
      setRefreshing(false);
    }
  };

  const handlePreviewAutoSeed = async () => {
    setSeeding(true);
    try {
      const plan = await adminRunCmsAutoSeed(user, true);
      setDryRunPlan(plan);
      toast.info("Dry-run Auto Seed preview ready. Review before applying.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to run Auto Seed preview");
    } finally {
      setSeeding(false);
    }
  };

  const handleExecuteAutoSeed = async () => {
    setSeeding(true);
    try {
      const result = await adminRunCmsAutoSeed(user, false);
      toast.success(
        `Auto Seed complete: ${result.createdCount} draft(s) created, ${result.skippedCount} existing preserved. Legal pages remain unpublished drafts.`
      );
      setDryRunPlan(null);
      await onRefreshState();
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute Auto Seed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="font-bold text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={handleRefresh}
            className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold flex items-center gap-1.5 border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh / Recheck
          </button>
          <button
            type="button"
            disabled={seeding || loading}
            onClick={handlePreviewAutoSeed}
            className="px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 border border-primary/20"
          >
            {seeding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Auto Seed (Dry-Run First)
          </button>
        </div>
      </div>

      {/* Dry-Run Preview Banner */}
      {dryRunPlan && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Database className="w-4 h-4" /> Auto Seed Dry-Run Preview (Zero Changes Written Yet)
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Only missing CMS pages will be created as private drafts. Existing Webmaster pages & settings are preserved, and legal pages remain unpublished.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDryRunPlan(null)}
                className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={seeding}
                onClick={handleExecuteAutoSeed}
                className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5"
              >
                {seeding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Missing Drafts
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {dryRunPlan.plan.map((item) => (
              <div
                key={item.slug}
                className="p-2.5 rounded-xl bg-card border border-border text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono">{item.route}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.action === "create_draft"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}
                  >
                    {item.action === "create_draft" ? "Create Draft" : "Skip Existing"}
                  </span>
                </div>
                <p className="text-muted-foreground leading-snug">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {visiblePages.map((pg) => {
            const badge = HEALTH_BADGE[pg.health] || HEALTH_BADGE.error;
            const doc = pg.published || pg.draft;
            const hasPendingDraft = Boolean(
              pg.draft && pg.published && pg.draft.version > pg.published.version
            );
            const liveHasDraftNotice = Boolean(
              pg.isLegalPage && pg.hasPublished && hasUnreviewedLegalDraftCopy(pg.published)
            );
            return (
              <div
                key={pg.slug}
                className="p-4 rounded-2xl border border-border bg-muted/15 hover:border-primary/40 transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {CMS_PAGE_LABELS[pg.slug]}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {pg.route}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {doc?.description ||
                      (pg.legacyPlaceholderFound
                        ? `Legacy text detected: "${pg.legacyTextPreview || ""}"`
                        : "No structured CMS page created yet.")}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-mono text-muted-foreground">
                    <span>
                      Order #{Number.isFinite(Number(doc?.displayOrder)) ? doc?.displayOrder : CMS_PAGE_DEFAULT_ORDER[pg.slug]}
                    </span>
                    <span>• Revisions: {pg.versionCount}</span>
                    {doc?.enabled === false && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold">
                        Disabled
                      </span>
                    )}
                    {doc?.publicVisible === false && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">
                        Public Hidden
                      </span>
                    )}
                    {doc?.footerVisible === false && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">
                        Footer Hidden
                      </span>
                    )}
                    {doc?.navVisible === true && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold">
                        In Navbar
                      </span>
                    )}
                    {pg.isLegalPage && !pg.hasPublished && (
                      <span className="text-rose-500 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Legal Draft Lock
                      </span>
                    )}
                    {liveHasDraftNotice && (
                      <span className="text-amber-500 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Live Copy Contains Draft Notice
                      </span>
                    )}
                    {hasPendingDraft && pg.draft && (
                      <span className="text-amber-500 flex items-center gap-1">
                        Draft v{pg.draft.version} pending
                      </span>
                    )}
                    {pg.published?.lastPublishedAt && (
                      <span className="text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Live v{pg.published.version}
                      </span>
                    )}
                    {pg.warnings.length > 0 && (
                      <span className="text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {pg.warnings.length} notice
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <a
                    href={pg.route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    View Route <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onEditPage(pg)}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Open CMS Editor
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
