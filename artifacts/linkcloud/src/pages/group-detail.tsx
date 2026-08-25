import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  getGroupById,
  getRelatedGroups,
  incrementJoinCount,
  incrementViewCount,
  addFavorite,
  removeFavorite,
  isFavorited,
} from "@/lib/firestore";
import type { Group } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2,
  ShieldAlert,
  ExternalLink,
  Users,
  ArrowLeft,
  MapPin,
  Hash,
  ShieldCheck,
  BadgeCheck,
  Pin,
  Heart,
  Share2,
  Globe,
  Copy,
  Eye,
  Calendar,
  Clock,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from "lucide-react";
import GroupCard from "@/components/group-card";
import ReportModal from "@/components/report-modal";
import { PlatformBadge, CategoryBadge, ContentTypeBadge, LanguageBadge } from "@/components/taxonomy-badge";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function GroupDetail() {
  const { id } = useParams();
  const { user, profile, isWebmaster } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [related, setRelated] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      setAccessDenied(false);
      try {
        const data = await getGroupById(id);
        if (!data) {
          setGroup(null);
          setLoading(false);
          return;
        }

        // Security check: Only approved & non-hidden groups are visible publicly
        const isOwner = user && data.submittedBy === user.uid;
        const isWebmasterUser = isWebmaster || profile?.role === "webmaster";
        const isApprovedPublic = data.status === "approved" && !data.hidden;

        if (!isApprovedPublic && !isOwner && !isWebmasterUser) {
          setAccessDenied(true);
          setGroup(null);
          setLoading(false);
          return;
        }

        setGroup(data);

        // Increment view count in Firestore (preventing fake view inflation via session storage)
        incrementViewCount(id);

        const [rel, fav] = await Promise.all([
          getRelatedGroups(data, 4),
          user ? isFavorited(user.uid, id) : Promise.resolve(false),
        ]);
        setRelated(rel);
        setFavorited(fav);
      } catch (err) {
        console.error("Error loading group details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, user, profile]);

  // Update page title and dynamic SEO Meta Tags
  useEffect(() => {
    if (!group) {
      document.title = "LinkCloud — Discover Communities";
      return;
    }

    const title = `${group.name} (${group.platform}) — LinkCloud`;
    document.title = title;

    // Set meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    const descText = group.description ? group.description.substring(0, 155) : `Join ${group.name} on ${group.platform}.`;
    if (metaDesc) {
      metaDesc.setAttribute("content", descText);
    }

    // Set OpenGraph
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute("content", title);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute("content", descText);

    // Set Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.href);

    // Set JSON-LD Structured Data
    let scriptTag = document.getElementById("json-ld-group") as HTMLScriptElement;
    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.id = "json-ld-group";
      scriptTag.type = "application/ld+json";
      document.head.appendChild(scriptTag);
    }
    scriptTag.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SocialMediaPosting",
      "headline": group.name,
      "description": group.description,
      "dateCreated": group.createdAt?.toDate ? group.createdAt.toDate().toISOString() : undefined,
      "interactionStatistic": {
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/FollowAction",
        "userInteractionCount": group.joinCount ?? 0,
      },
    });

    return () => {
      document.title = "LinkCloud";
    };
  }, [group]);

  const isLinkActive = group?.linkStatus !== "inactive";

  const handleJoin = async () => {
    if (!group) return;
    if (!isLinkActive) {
      toast.error("This invite link is currently unavailable.");
      return;
    }
    try {
      await incrementJoinCount(group.id);
      setGroup((prev) => (prev ? { ...prev, joinCount: (prev.joinCount ?? 0) + 1 } : null));
    } catch {
      // ignore
    }
    window.open(group.joinUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyInviteLink = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.joinUrl);
    toast.success("Invite link copied to clipboard!");
  };

  const handleFavorite = async () => {
    if (!user) {
      toast.error("Sign in to save favorites");
      return;
    }
    if (!group) return;
    setFavLoading(true);
    try {
      if (favorited) {
        await removeFavorite(user.uid, group.id);
        setFavorited(false);
        toast.success("Removed from favorites");
      } else {
        await addFavorite(user.uid, group.id);
        setFavorited(true);
        toast.success("Added to favorites");
      }
    } catch {
      toast.error("Failed to update favorites");
    } finally {
      setFavLoading(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: group?.name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Page link copied!"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 max-w-md mx-auto p-8 bg-card border border-border rounded-3xl shadow-sm">
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">
          This community is pending review, hidden, or unavailable. Only the Webmaster and the submitter can view unapproved groups.
        </p>
        <Link
          href="/groups"
          className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
        >
          Explore Approved Communities
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Community Not Found</h2>
        <p className="text-muted-foreground">
          The requested community does not exist or has been removed.
        </p>
        <Link
          href="/groups"
          className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
        >
          Browse Communities
        </Link>
      </div>
    );
  }

  const isOwner = Boolean(user && group.submittedBy === user.uid);
  const isWebmasterUser = Boolean(isWebmaster || profile?.role === "webmaster");
  const canSeePrivateDetails = isOwner || isWebmasterUser;

  const locationParts = [group.city, group.district, group.state].filter(Boolean).join(", ");

  const createdDateStr = group.createdAt?.toDate
    ? group.createdAt.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Recently";

  const updatedDateStr = group.updatedAt?.toDate
    ? group.updatedAt.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Recently";

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Discover
      </Link>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header Card */}
          <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-muted border-2 border-border/80 shadow-md flex-shrink-0 flex items-center justify-center">
                {group.logoUrl ? (
                  <img
                    src={group.logoUrl}
                    alt={group.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-4xl font-bold text-muted-foreground uppercase">
                    {group.name.substring(0, 2)}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                    {group.name}
                  </h1>
                  {group.featured && (
                    <BadgeCheck className="w-6 h-6 text-amber-500 flex-shrink-0" />
                  )}
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap gap-2">
                  <PlatformBadge name={group.platform} size="md" />
                  <CategoryBadge name={group.categoryName} size="md" />
                  {group.contentType && <ContentTypeBadge name={group.contentType} size="md" />}
                  {group.language && <LanguageBadge name={group.language} size="md" />}
                </div>

                {/* Link status indicator */}
                <div className="flex items-center gap-2 pt-1">
                  {isLinkActive ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4" /> Invite Link Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider">
                      <XCircle className="w-4 h-4" /> Invite Link Inactive
                    </span>
                  )}

                  {group.minimumAge && (
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">
                      Min Age: {group.minimumAge}+
                    </span>
                  )}
                </div>

                {canSeePrivateDetails && locationParts && (
                  <p className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground pt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0 text-primary" />
                    {locationParts}
                  </p>
                )}
              </div>
            </div>

            {/* Inactive Banner */}
            {!isLinkActive && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3 text-destructive text-xs sm:text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  <strong>This invite link is currently unavailable.</strong> The group admin may have reset or invalidated the link.
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
            <h3 className="text-lg font-bold">Community Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
              {group.description}
            </p>
          </div>

          {/* Rules */}
          {group.rules && (
            <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" /> Rules & Guidelines
              </h3>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {group.rules}
              </p>
            </div>
          )}

          {/* Private Owner & Webmaster Details */}
          {canSeePrivateDetails && (
            <div className="bg-card border border-primary/20 bg-primary/5 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center justify-between">
                <span>Submission & Ownership Details</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-primary/10 text-primary uppercase tracking-wide">
                  {isWebmasterUser ? "Webmaster Access" : "Owner Access"}
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {group.submittedByName && (
                  <div className="p-3 bg-background/80 rounded-2xl space-y-1 border border-border/50">
                    <p className="text-muted-foreground font-medium">Submitted By Name</p>
                    <p className="font-bold text-foreground">{group.submittedByName}</p>
                  </div>
                )}
                {group.submittedByEmail && (
                  <div className="p-3 bg-background/80 rounded-2xl space-y-1 border border-border/50">
                    <p className="text-muted-foreground font-medium">Submitter Email</p>
                    <p className="font-bold text-foreground">{group.submittedByEmail}</p>
                  </div>
                )}
                {group.submittedBy && (
                  <div className="p-3 bg-background/80 rounded-2xl space-y-1 border border-border/50">
                    <p className="text-muted-foreground font-medium">Submitter UID</p>
                    <p className="font-bold text-foreground font-mono text-[11px] truncate">{group.submittedBy}</p>
                  </div>
                )}
                {isWebmasterUser && group.id && (
                  <div className="p-3 bg-background/80 rounded-2xl space-y-1 border border-border/50">
                    <p className="text-muted-foreground font-medium">Firestore Document ID</p>
                    <p className="font-bold text-foreground font-mono text-[11px] truncate">{group.id}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {group.tags?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Hash className="w-4 h-4" /> Community Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl bg-card border border-border text-foreground text-xs font-semibold"
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 shadow-xl lg:sticky lg:top-24 space-y-5">
            {/* Primary Action Button */}
            <button
              onClick={handleJoin}
              disabled={!isLinkActive}
              className={`w-full py-4 text-base font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                isLinkActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-primary/25"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              }`}
            >
              {isLinkActive ? (
                <>Join Community <ExternalLink className="w-5 h-5" /></>
              ) : (
                "Link Unavailable"
              )}
            </button>

            {/* Secondary Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyInviteLink}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border border-border hover:bg-muted text-foreground transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Invite
              </button>

              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border border-border hover:bg-muted text-foreground transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>

            <button
              onClick={handleFavorite}
              disabled={favLoading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors border ${
                favorited
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`w-4 h-4 ${favorited ? "fill-current" : ""}`} />
              {favorited ? "Saved to Favorites" : "Save to Favorites"}
            </button>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <div className="text-center p-3 bg-muted/30 rounded-2xl">
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 mb-0.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Joins
                </p>
                <p className="text-xl font-bold">{(group.joinCount ?? 0).toLocaleString()}</p>
              </div>

              <div className="text-center p-3 bg-muted/30 rounded-2xl">
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 mb-0.5">
                  <Eye className="w-3.5 h-3.5 text-blue-500" /> Views
                </p>
                <p className="text-xl font-bold">{(group.viewsCount ?? 1).toLocaleString()}</p>
              </div>
            </div>

            {/* Report Button (Open to anyone) */}
            <button
              onClick={() => setReportOpen(true)}
              className="w-full py-2.5 bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" /> Report Group / Broken Link
            </button>
          </div>
        </div>
      </motion.div>

      {/* Related Groups */}
      {related.length > 0 && (
        <div className="pt-10 border-t border-border space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Related {group.platform} Communities</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Discover similar groups you might be interested in</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((g, i) => (
              <GroupCard key={g.id} group={g} delay={i * 0.08} />
            ))}
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        groupId={group.id}
        groupName={group.name}
      />
    </div>
  );
}
