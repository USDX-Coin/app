export function MintFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
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

      {/* Address input skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="h-12 w-full bg-muted rounded-xl" />
      </div>

      {/* Summary skeleton */}
      <div className="space-y-3 rounded-lg bg-muted/50 p-4">
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
      </div>

      {/* Button skeleton */}
      <div className="h-12 w-full bg-muted rounded-xl" />
    </div>
  );
}
