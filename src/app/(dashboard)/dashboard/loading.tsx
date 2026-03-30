export default function Loading() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      {/* Greeting */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded-lg" />
        <div className="h-4 w-96 bg-muted rounded-md" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/30 p-5 space-y-3">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-10 w-24 bg-muted rounded" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Upcoming workouts */}
      <div className="space-y-3">
        <div className="h-5 w-32 bg-muted rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/20 p-4 flex items-center gap-4">
            <div className="h-10 w-10 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
            <div className="h-6 w-16 bg-muted rounded-full" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/30 p-5 space-y-3">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-40 w-full bg-muted rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
