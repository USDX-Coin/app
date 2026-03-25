export function ProfileCardSkeleton() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      <div className="h-7 w-20 bg-muted rounded mb-6" />

      <div className="rounded-2xl border border-border bg-white p-6 space-y-6">
        {/* Badge skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-5 w-16 bg-muted rounded" />
          <div className="h-5 w-40 bg-muted rounded-full" />
        </div>

        {/* Info rows */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 bg-muted rounded mb-2" />
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
