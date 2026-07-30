import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  getGroupById,
  getApprovedGroups,
  incrementJoinCount,
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
  Heart,
  Share2,
  Globe,
} from "lucide-react";
import GroupCard from "@/components/group-card";
import ReportModal from "@/components/report-modal";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/platform-icon";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [related, setRelated] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      try {
        const data = await getGroupById(id);
        setGroup(data);
        if (data) {
          const [rel, fav] = await Promise.all([
            getApprovedGroups({ platform: data.platform }),
            user ? isFavorited(user.uid, id) : Promise.resolve(false),
          ]);
          setRelated(rel.filter((g) => g.id !== id).slice(0, 4));
          setFavorited(fav);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, user]);

  // Update page title
  useEffect(() => {
    if (group) document.title = `${group.name} — LinkCloud`;
    return () => { document.title = "LinkCloud"; };
  }, [group]);

  const handleJoin = async () => {
    if (!group) return;
    try {
      await incrementJoinCount(group.id);
      setGroup((prev) => prev ? { ...prev, joinCount: (prev.joinCount ?? 0) + 1 } : null);
    } catch {
      // ignore
    }
    window.open(group.joinUrl, "_blank", "noopener,noreferrer");
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
      navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Community not found</h2>
        <p className="text-muted-foreground">
          This group may have been removed or is pending approval.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-colors"
        >
          Browse Communities
        </Link>
      </div>
    );
  }

  const locationParts = [group.city, group.district, group.state].filter(Boolean).join(", ");
  const platformColor = PLATFORM_COLORS[group.platform] ?? "text-muted-foreground";

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Discover
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div className="flex gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-muted border-2 border-border/50 shadow-xl flex-shrink-0 flex items-center justify-center">
              {group.logoUrl ? (
                <img
                  src={group.logoUrl}
                  alt={group.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span className="text-4xl font-bold text-muted-foreground uppercase">
                  {group.name.substring(0, 2)}
                </span>
              )}
            </div>

            <div className="flex flex-col justify-center space-y-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                  {group.name}
                </h1>
                {group.featured && <BadgeCheck className="w-6 h-6 text-amber-500 flex-shrink-0" />}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium`}>
                  <PlatformIcon platform={group.platform} className={`w-4 h-4 ${platformColor}`} />
                  {group.platform}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-sm font-medium text-muted-foreground">
                  {group.categoryName}
                </span>
                {group.language && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-sm font-medium text-muted-foreground">
                    <Globe className="w-3.5 h-3.5" /> {group.language}
                  </span>
                )}
              </div>

              {locationParts && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  {locationParts}
                </p>
              )}
            </div>
          </div>

          {/* About */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold">About this community</h3>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-base">
              {group.description}
            </p>
          </div>

          {/* Rules */}
          {group.rules && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-5 space-y-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" /> Community Rules
              </h3>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {group.rules}
              </p>
            </div>
          )}

          {/* Tags */}
          {group.tags?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Hash className="w-4 h-4" /> Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg bg-muted text-foreground text-sm font-medium"
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-xl lg:sticky lg:top-24 space-y-5">
            {/* Join button */}
            <button
              onClick={handleJoin}
              className="w-full py-4 bg-primary text-primary-foreground text-base font-bold rounded-2xl hover:bg-primary/90 transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
            >
              Join Community <ExternalLink className="w-5 h-5" />
            </button>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleFavorite}
                disabled={favLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                  favorited
                    ? "bg-red-500/10 border-red-500/30 text-red-500"
                    : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart className={`w-4 h-4 ${favorited ? "fill-current" : ""}`} />
                {favorited ? "Saved" : "Save"}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                  <Users className="w-3.5 h-3.5" /> Joins
                </p>
                <p className="text-2xl font-bold">{(group.joinCount ?? 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                  <MapPin className="w-3.5 h-3.5" /> Location
                </p>
                <p className="text-sm font-semibold truncate px-1" title={locationParts}>
                  {group.state || "India"}
                </p>
              </div>
            </div>

            {/* Submitted by */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold uppercase text-muted-foreground text-sm flex-shrink-0">
                  {group.submittedByName?.substring(0, 2) || "AN"}
                </div>
                <div className="text-sm min-w-0">
                  <p className="text-xs text-muted-foreground">Submitted by</p>
                  <p className="font-semibold truncate">{group.submittedByName || "Anonymous"}</p>
                </div>
              </div>
            </div>

            {/* Report */}
            <button
              onClick={() => setReportOpen(true)}
              className="w-full py-2.5 bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" /> Report Issue
            </button>
          </div>
        </div>
      </motion.div>

      {/* Related */}
      {related.length > 0 && (
        <div className="pt-8 border-t border-border/50 space-y-5">
          <h2 className="text-xl font-bold">More {group.platform} Communities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((g, i) => (
              <GroupCard key={g.id} group={g} delay={i * 0.08} />
            ))}
          </div>
        </div>
      )}

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        groupId={group.id}
        groupName={group.name}
      />
    </div>
  );
}
