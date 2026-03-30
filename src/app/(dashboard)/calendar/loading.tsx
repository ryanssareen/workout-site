export default function Loading() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Calendar header (nav + view toggle) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-muted rounded-md" />
          <div className="h-6 w-40 bg-muted rounded-md" />
          <div className="h-8 w-8 bg-muted rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-muted rounded-md" />
          <div className="h-8 w-24 bg-muted rounded-md" />
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-px">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-6 bg-muted rounded" />
        ))}
      </div>

      {/* Calendar grid (5 weeks) */}
      <div className="grid grid-cols-7 gap-px">
        {[...Array(35)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-md border border-border/20 p-2">
            <div className="h-4 w-4 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
