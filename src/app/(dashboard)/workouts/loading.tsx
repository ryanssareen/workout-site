export default function Loading() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-6 w-32 bg-muted rounded-md" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
        <div className="h-8 w-28 bg-muted rounded-md" />
      </div>

      {/* Filter tabs */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-7 w-20 bg-muted rounded-md" />
          ))}
        </div>
        <div className="flex gap-1.5">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-7 w-16 bg-muted rounded-full" />
          ))}
        </div>
      </div>

      {/* Workout list */}
      <div className="space-y-1.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/20 p-3 flex items-center gap-3">
            <div className="h-9 w-9 bg-muted rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="flex gap-2">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
            </div>
            <div className="h-5 w-14 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
