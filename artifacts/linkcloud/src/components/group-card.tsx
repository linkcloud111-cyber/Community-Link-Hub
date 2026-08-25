import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Users,
  ExternalLink,
  BadgeCheck,
  Pin,
  MapPin,
  Share2,
  Copy,
  Check,
  Info,
  Globe,
  Radio,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Group } from "@/lib/types";
import { incrementJoinCount } from "@/lib/firestore";
import { PlatformIcon } from "@/components/platform-icon";
import { CategoryIcon } from "@/components/category-icon";
import { getPlatformVisual, getCategoryVisual } from "@/lib/taxonomy-visuals";
import ReportModal from "@/components/report-modal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GroupCardProps {
  group: Group;
  delay?: number;
}

export default function GroupCard({ group, delay = 0 }: GroupCardProps) {
  const { user, isWebmaster, profile } = useAuth();
  const [, setLocation] = useLocation();
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isOwner = Boolean(user && group.submittedBy === user.uid);
  const isWebmasterUser = Boolean(isWebmaster || profile?.role === "webmaster");
  const canSeeLocation = isOwner || isWebmasterUser;

  const isLinkActive = group.linkStatus !== "inactive";
  const platVisual = getPlatformVisual(group.platform);
  const catVisual = getCategoryVisual(group.categoryName);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLinkActive) {
      toast.error("Invite Link Currently Unavailable.");
      return;
    }
    try {
      await incrementJoinCount(group.id);
    } catch {
      // ignore
    }
    window.open(group.joinUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(group.joinUrl);
    setCopied(true);
    toast.success("Community invite link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pageUrl = `${window.location.origin}/groups/${group.id}`;
    if (navigator.share) {
      navigator.share({
        title: group.name,
        text: `Check out ${group.name} on LinkCloud!`,
        url: pageUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(pageUrl);
      toast.success("Group page URL copied to clipboard!");
    }
  };

  const handleReport = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReportOpen(true);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation(`/groups/${group.id}`);
  };

  const locationParts = [group.city, group.district, group.state]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay }}
      >
        <div
          onClick={() => setLocation(`/groups/${group.id}`)}
          className="group relative h-full flex flex-col rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 cursor-pointer"
        >
          {/* Top accent border line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="p-5 flex-1 flex flex-col gap-3">
            {/* Header row: logo + badges */}
            <div className="flex items-start justify-between gap-3">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center border border-border/80 shadow-sm">
                {!imageError && group.logoUrl ? (
                  <img
                    src={group.logoUrl}
                    alt={group.name}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <PlatformIcon
                    platform={group.platform}
                    className="w-7 h-7"
                    style={platVisual.iconStyle}
                  />
                )}
                {/* Platform badge icon overlay */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center shadow-sm border border-border">
                  <PlatformIcon
                    platform={group.platform}
                    className="w-3 h-3"
                    style={platVisual.iconStyle}
                  />
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 min-w-0">
                <div className="flex items-center gap-1">
                  {group.pinned && (
                    <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 whitespace-nowrap">
                      <Pin className="w-2.5 h-2.5" /> Pinned
                    </span>
                  )}
                  {group.featured && (
                    <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">
                      <BadgeCheck className="w-3 h-3" /> Featured
                    </span>
                  )}
                </div>
                <span
                  style={catVisual.badgeStyle}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border truncate max-w-[120px] flex items-center gap-1"
                >
                  <CategoryIcon name={group.categoryName} className="w-2.5 h-2.5 shrink-0" style={catVisual.iconStyle} />
                  <span className="truncate">{group.categoryName}</span>
                </span>
              </div>
            </div>

            {/* Group Name & Location */}
            <div>
              <h3 className="text-base font-bold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                {group.name}
              </h3>
              {canSeeLocation && locationParts && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 line-clamp-1">
                  <MapPin className="w-3 h-3 flex-shrink-0 text-primary/70" />
                  {locationParts}
                </p>
              )}
            </div>

            {/* Badges row: Content Type, Language, Active Status */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5" />
                {group.contentType || "Public Community"}
              </span>

              {group.language && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5" />
                  {group.language}
                </span>
              )}

              {isLinkActive ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Active Link
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                  <XCircle className="w-2.5 h-2.5" /> Inactive
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
              {group.description}
            </p>

            {/* Tags preview */}
            {group.tags && group.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {group.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
                {group.tags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground font-medium px-1">
                    +{group.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Member/Join and View stats */}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground font-medium pt-1 border-t border-border/40">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-primary" />
                {(group.joinCount ?? 0).toLocaleString()} joins
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-blue-500" />
                {(group.viewsCount ?? 0).toLocaleString()} views
              </span>
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="px-3 pb-3 pt-2 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-1">
            {/* Join Button */}
            <button
              onClick={handleJoin}
              disabled={!isLinkActive}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isLinkActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              }`}
              title={isLinkActive ? "Join Group" : "Invite Link Currently Unavailable."}
            >
              Join <ExternalLink className="w-3 h-3" />
            </button>

            {/* View Details */}
            <button
              onClick={handleViewDetails}
              className="p-1.5 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 rounded-xl text-xs font-medium transition-colors"
              title="View Details"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="p-1.5 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 rounded-xl text-xs font-medium transition-colors"
              title="Copy Invite Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="p-1.5 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 rounded-xl text-xs font-medium transition-colors"
              title="Share Group"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Report */}
            <button
              onClick={handleReport}
              className="p-1.5 bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border/60 rounded-xl text-xs font-medium transition-colors"
              title="Report Group"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Report Modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        groupId={group.id}
        groupName={group.name}
      />
    </>
  );
}
