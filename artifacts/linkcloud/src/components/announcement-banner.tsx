import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Megaphone,
  Info,
  AlertCircle,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { subscribeActiveAnnouncements } from "@/lib/firestore";
import type { Announcement, AnnouncementType } from "@/lib/types";

// Safe URL validator: blocks javascript:, data:, vbscript:, file:
export function isSafeActionUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:")
  ) {
    return false;
  }
  return true;
}

// Visual themes for announcement types
export const ANNOUNCEMENT_THEMES: Record<
  AnnouncementType,
  {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  info: {
    bg: "bg-sky-950/80 dark:bg-sky-950/90 text-sky-100",
    border: "border-sky-500/30",
    text: "text-sky-100",
    badgeBg: "bg-sky-500/20 text-sky-200 border-sky-400/30",
    badgeText: "text-sky-200",
    icon: Info,
    label: "Info",
  },
  announcement: {
    bg: "bg-purple-950/80 dark:bg-purple-950/90 text-purple-100",
    border: "border-purple-500/30",
    text: "text-purple-100",
    badgeBg: "bg-purple-500/20 text-purple-200 border-purple-400/30",
    badgeText: "text-purple-200",
    icon: Megaphone,
    label: "Announcement",
  },
  important: {
    bg: "bg-amber-950/85 dark:bg-amber-950/90 text-amber-100",
    border: "border-amber-500/40",
    text: "text-amber-100",
    badgeBg: "bg-amber-500/25 text-amber-200 border-amber-400/40",
    badgeText: "text-amber-200",
    icon: AlertCircle,
    label: "Important",
  },
  warning: {
    bg: "bg-rose-950/85 dark:bg-rose-950/90 text-rose-100",
    border: "border-rose-500/40",
    text: "text-rose-100",
    badgeBg: "bg-rose-500/25 text-rose-200 border-rose-400/40",
    badgeText: "text-rose-200",
    icon: AlertTriangle,
    label: "Notice",
  },
  maintenance: {
    bg: "bg-orange-950/85 dark:bg-orange-950/90 text-orange-100",
    border: "border-orange-500/40",
    text: "text-orange-100",
    badgeBg: "bg-orange-500/25 text-orange-200 border-orange-400/40",
    badgeText: "text-orange-200",
    icon: Wrench,
    label: "Maintenance",
  },
  success: {
    bg: "bg-emerald-950/80 dark:bg-emerald-950/90 text-emerald-100",
    border: "border-emerald-500/30",
    text: "text-emerald-100",
    badgeBg: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
    badgeText: "text-emerald-200",
    icon: CheckCircle2,
    label: "Update",
  },
};

const DISMISSED_STORAGE_KEY_PREFIX = "lc_dismissed_announcement_";

export function isAnnouncementDismissedLocally(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${DISMISSED_STORAGE_KEY_PREFIX}${id}`) === "true";
  } catch {
    return false;
  }
}

export function dismissAnnouncementLocally(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${DISMISSED_STORAGE_KEY_PREFIX}${id}`, "true");
  } catch {
    // Ignore localStorage errors
  }
}

interface AnnouncementBannerProps {
  /** Optional override for previewing inside Webmaster settings without affecting global feed */
  previewItem?: Announcement;
  previewMode?: "desktop" | "mobile";
  onDismissPreview?: () => void;
}

export default function AnnouncementBanner({
  previewItem,
  previewMode,
  onDismissPreview,
}: AnnouncementBannerProps = {}) {
  const [location] = useLocation();
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Subscribe to realtime active announcements if not in isolated preview
  useEffect(() => {
    if (previewItem) return;

    const unsubscribe = subscribeActiveAnnouncements((items) => {
      setAllAnnouncements(items);

      // Check local storage for dismissed IDs
      const dismissed = new Set<string>();
      items.forEach((item) => {
        if (item.dismissible && isAnnouncementDismissedLocally(item.id)) {
          dismissed.add(item.id);
        }
      });
      setDismissedIds(dismissed);
    });

    return () => {
      unsubscribe();
    };
  }, [previewItem]);

  // Compute visible items
  const visibleItems = useMemo(() => {
    if (previewItem) {
      return [previewItem];
    }
    return allAnnouncements.filter((item) => !dismissedIds.has(item.id));
  }, [previewItem, allAnnouncements, dismissedIds]);

  // Reset index if out of bounds
  useEffect(() => {
    if (currentIndex >= visibleItems.length && visibleItems.length > 0) {
      setCurrentIndex(0);
    }
  }, [visibleItems.length, currentIndex]);

  // Auto-rotate multiple static banners every 7 seconds if not paused
  useEffect(() => {
    if (visibleItems.length <= 1 || isPaused || prefersReducedMotion) return;
    const current = visibleItems[currentIndex];
    if (current && current.displayMode === "ticker") return; // Tickers scroll continuously

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleItems.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [visibleItems, currentIndex, isPaused, prefersReducedMotion]);

  const handleDismiss = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (previewItem) {
        onDismissPreview?.();
        return;
      }
      dismissAnnouncementLocally(id);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [previewItem, onDismissPreview]
  );

  // If no visible announcements, return nothing
  if (visibleItems.length === 0) {
    return null;
  }

  // Handle current announcement
  const currentAnnouncement = visibleItems[currentIndex] || visibleItems[0];
  const theme = ANNOUNCEMENT_THEMES[currentAnnouncement.type] || ANNOUNCEMENT_THEMES.announcement;
  const IconComponent = theme.icon;
  const isTicker = currentAnnouncement.displayMode === "ticker";

  // URL Safety
  const safeUrl = isSafeActionUrl(currentAnnouncement.actionUrl)
    ? currentAnnouncement.actionUrl!.trim()
    : null;
  const isExternalUrl = safeUrl ? /^https?:\/\//i.test(safeUrl) : false;

  const renderAction = () => {
    if (!safeUrl || !currentAnnouncement.actionLabel) return null;

    const actionContent = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 text-white transition-all shadow-sm flex-shrink-0 cursor-pointer border border-white/20">
        <span>{currentAnnouncement.actionLabel}</span>
        {isExternalUrl ? (
          <ExternalLink className="w-3 h-3 opacity-80" />
        ) : (
          <ChevronRight className="w-3 h-3 opacity-80" />
        )}
      </span>
    );

    if (isExternalUrl) {
      return (
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus:outline-none focus:ring-2 focus:ring-white/40 rounded-lg inline-block flex-shrink-0"
        >
          {actionContent}
        </a>
      );
    }

    return (
      <Link
        href={safeUrl}
        className="focus:outline-none focus:ring-2 focus:ring-white/40 rounded-lg inline-block flex-shrink-0"
      >
        {actionContent}
      </Link>
    );
  };

  return (
    <aside
      role="region"
      aria-label="Website Announcements"
      aria-live="polite"
      className={`relative w-full border-b transition-colors duration-300 z-40 select-none ${theme.bg} ${theme.border} ${
        previewMode === "mobile" ? "max-w-sm mx-auto rounded-xl border mt-2 overflow-hidden shadow-md" : ""
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3 min-w-0">
        {/* Left: Type Badge & Navigation (if multiple) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border shadow-sm ${theme.badgeBg}`}
          >
            <IconComponent className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
            <span className="hidden xs:inline">{theme.label}</span>
          </span>

          {visibleItems.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono opacity-80 pl-1">
              <span>
                {currentIndex + 1}/{visibleItems.length}
              </span>
            </div>
          )}
        </div>

        {/* Center: Message Content (Ticker vs Static Banner) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {isTicker ? (
            <div className="relative w-full overflow-hidden flex items-center">
              <div
                className={`whitespace-nowrap flex items-center gap-6 ${
                  prefersReducedMotion || isPaused
                    ? "overflow-x-auto scrollbar-none"
                    : "animate-announcement-ticker"
                }`}
                style={{
                  willChange: "transform",
                }}
              >
                <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium">
                  {currentAnnouncement.title && (
                    <strong className="font-bold text-white tracking-tight">
                      {currentAnnouncement.title}:
                    </strong>
                  )}
                  <span className="opacity-95">{currentAnnouncement.message}</span>
                </div>
                {/* Secondary duplicate text for seamless loop continuity */}
                {!prefersReducedMotion && !isPaused && (
                  <div
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium"
                    aria-hidden="true"
                  >
                    <span className="text-white/40">•</span>
                    {currentAnnouncement.title && (
                      <strong className="font-bold text-white tracking-tight">
                        {currentAnnouncement.title}:
                      </strong>
                    )}
                    <span className="opacity-95">{currentAnnouncement.message}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium overflow-hidden">
              <div className="truncate">
                {currentAnnouncement.title && (
                  <strong className="font-bold text-white mr-1.5 tracking-tight">
                    {currentAnnouncement.title}:
                  </strong>
                )}
                <span className="opacity-95">{currentAnnouncement.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Action Button, Controls, & Dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {renderAction()}

          {/* Controls for Multiple items or Ticker pause */}
          <div className="flex items-center gap-0.5">
            {isTicker && (
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="p-1 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label={isPaused ? "Play scrolling announcement" : "Pause scrolling announcement"}
                title={isPaused ? "Resume ticker scroll" : "Pause ticker scroll"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            )}

            {visibleItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex(
                      (prev) => (prev - 1 + visibleItems.length) % visibleItems.length
                    )
                  }
                  className="p-1 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-label="Previous announcement"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex((prev) => (prev + 1) % visibleItems.length)
                  }
                  className="p-1 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-label="Next announcement"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Dismiss Button (Only if dismissible) */}
          {currentAnnouncement.dismissible && (
            <button
              type="button"
              onClick={(e) => handleDismiss(currentAnnouncement.id, e)}
              className="p-1 rounded-md hover:bg-white/15 text-white/70 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/40 ml-1"
              aria-label="Dismiss announcement"
              title="Dismiss announcement"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
