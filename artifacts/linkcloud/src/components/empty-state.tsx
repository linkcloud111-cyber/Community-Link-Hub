import React from "react";
import { Link } from "wouter";
import { FolderSearch, RotateCcw } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`min-h-[300px] flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-3xl border border-dashed border-border bg-card/40 backdrop-blur-sm space-y-4 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center shadow-inner">
        {icon || <FolderSearch className="w-8 h-8" />}
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {actionLabel && (
        <div className="pt-2">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-sm"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
