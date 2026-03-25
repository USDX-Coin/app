export function RedeemFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Wallet connect skeleton */}
      <div className="h-12 w-full bg-muted rounded-xl" />

      {/* Chain selector skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-12 w-full bg-muted rounded-xl" />
      </div>

      {/* Amount input skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-12 w-full bg-muted rounded-xl" />
      </div>

      {/* Bank account selector skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-36 bg-muted rounded" />
        <div className="h-12 w-full bg-muted rounded-xl" />
      </div>

      {/* Button skeleton */}
      <div className="h-12 w-full bg-muted rounded-xl" />
    </div>
  );
}
