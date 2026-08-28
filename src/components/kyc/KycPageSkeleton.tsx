import { Skeleton } from "@/components/ui/skeleton";

// Shown while /api/v2/auth/me and /v2/kyc/me are still in flight. Deliberately
// text-free: the page must not assert anything about the customer's verification
// state before the server has said what it is.
export function KycPageSkeleton() {
  return (
    <div
      data-testid="kyc-page-skeleton"
      className="mx-auto w-full max-w-xl space-y-6"
      aria-busy="true"
    >
      {/* Title + subtitle */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Status banner */}
      <Skeleton className="h-20 w-full rounded-lg" />

      {/* Form fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
