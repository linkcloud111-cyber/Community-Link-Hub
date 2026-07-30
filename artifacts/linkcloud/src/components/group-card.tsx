import { useState } from "react";
import { Link } from "wouter";
import { Users, ExternalLink, BadgeCheck, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import type { Group } from "@/lib/types";
import { incrementJoinCount } from "@/lib/firestore";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/platform-icon";

interface GroupCardProps {
  group: Group;
  delay?: number;
}

export default function GroupCard({ group, delay = 0 }: GroupCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await incrementJoinCount(group.id);
    } catch {
      // ignore
    }
    window.open(group.joinUrl, "_blank", "noopener,noreferrer");
  };

  const locationParts = [group.city, group.district, group.state]
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Link href={`/groups/${group.id}`}>
        <div className="group relative h-full flex flex-col rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 cursor-pointer">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="p-5 flex-1 flex flex-col gap-3">
            {/* Header row: logo + badges */}
            <div className="flex items-start justify-between gap-3">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center border border-border">
                {!imageError && group.logoUrl ? (
                  <img
                    src={group.logoUrl}
                    alt={group.name}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground uppercase">
                    {group.name.substring(0, 2)}
                  </span>
                )}
                {/* Platform badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center shadow-sm border border-border">
                  <PlatformIcon
                    platform={group.platform}
                    className={`w-3 h-3 ${PLATFORM_COLORS[group.platform] ?? "text-muted-foreground"}`}
                  />
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 min-w-0">
                {group.featured && (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">
                    <BadgeCheck className="w-3 h-3" /> Featured
                  </span>
                )}
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/50 truncate max-w-[100px]">
                  {group.categoryName}
                </span>
              </div>
            </div>

            {/* Name + location */}
            <div>
              <h3 className="text-base font-bold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                {group.name}
              </h3>
              {locationParts && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 line-clamp-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {locationParts}
                </p>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed flex-1">
              {group.description}
            </p>

            {/* Tags */}
            {group.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-auto pt-1">
                {group.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md"
                  >
                    #{tag.trim()}
                  </span>
                ))}
                {group.tags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                    +{group.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <Users className="w-3.5 h-3.5 text-primary/60" />
              <span>{(group.joinCount ?? 0).toLocaleString()} joined</span>
            </div>
            <button
              onClick={handleJoin}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              Join <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
