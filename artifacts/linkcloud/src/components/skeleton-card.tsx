export default function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden animate-pulse flex flex-col h-full shadow-sm">
      <div className="p-5 flex-1 flex flex-col gap-3">
        {/* Header row: logo + badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted/80 flex-shrink-0" />
          <div className="flex flex-col items-end gap-1.5">
            <div className="h-4 w-16 bg-muted/80 rounded-full" />
            <div className="h-4 w-20 bg-muted/80 rounded-full" />
          </div>
        </div>
        {/* Title and subtitle */}
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 bg-muted/80 rounded-lg" />
          <div className="h-3 w-1/2 bg-muted/60 rounded-lg" />
        </div>
        {/* Description lines */}
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-muted/60 rounded-lg" />
          <div className="h-3 w-4/5 bg-muted/60 rounded-lg" />
        </div>
        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <div className="h-5 w-20 bg-muted/70 rounded-md" />
          <div className="h-5 w-14 bg-muted/70 rounded-md" />
          <div className="h-5 w-16 bg-muted/70 rounded-md" />
        </div>
      </div>
      {/* Bottom bar */}
      <div className="px-5 pb-4 pt-2 border-t border-border/40 flex items-center justify-between">
        <div className="h-4 w-16 bg-muted/70 rounded-lg" />
        <div className="h-8 w-20 bg-muted/80 rounded-xl" />
      </div>
    </div>
  );
}
