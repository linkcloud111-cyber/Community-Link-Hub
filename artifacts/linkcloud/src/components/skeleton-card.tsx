export default function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden animate-pulse">
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="w-14 h-14 rounded-xl bg-muted flex-shrink-0" />
          <div className="flex flex-col items-end gap-1.5">
            <div className="h-4 w-16 bg-muted rounded-full" />
            <div className="h-4 w-20 bg-muted rounded-full" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded-lg" />
          <div className="h-3 w-1/2 bg-muted rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-muted rounded-lg" />
          <div className="h-3 w-5/6 bg-muted rounded-lg" />
        </div>
        <div className="flex gap-1">
          <div className="h-5 w-12 bg-muted rounded-md" />
          <div className="h-5 w-16 bg-muted rounded-md" />
          <div className="h-5 w-10 bg-muted rounded-md" />
        </div>
      </div>
      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="h-4 w-20 bg-muted rounded-lg" />
        <div className="h-8 w-16 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
