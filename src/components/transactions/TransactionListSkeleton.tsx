export function TransactionListSkeleton() {
  return (
    <>
      {/* Desktop Table Skeleton */}
      <div className="hidden md:block rounded-2xl border border-border bg-white">
        <div className="p-4 space-y-4 animate-pulse">
          {/* Header row */}
          <div className="grid grid-cols-6 gap-4">
            {["Date", "Type", "Amount", "Chain", "Tx Hash", "Status"].map(
              (_, i) => (
                <div key={i} className="h-3 w-16 bg-muted rounded" />
              )
            )}
          </div>
          <div className="border-t border-border" />
          {/* Data rows */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-4">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-12 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-3 w-14 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Cards Skeleton */}
      <div className="md:hidden space-y-3 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-12 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-5 w-24 bg-muted rounded" />
              <div className="h-3 w-10 bg-muted rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
