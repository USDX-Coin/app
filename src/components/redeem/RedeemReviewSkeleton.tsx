export function RedeemReviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 w-28 bg-muted rounded" />

      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-28 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3 flex justify-between">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>

      <div className="h-12 w-full bg-muted rounded-xl" />
    </div>
  );
}
