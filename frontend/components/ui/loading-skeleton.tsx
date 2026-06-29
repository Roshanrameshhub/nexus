export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5 animate-pulse">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary" />
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-secondary rounded w-1/3" />
              <div className="h-3 bg-secondary rounded w-full" />
              <div className="h-3 bg-secondary rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
