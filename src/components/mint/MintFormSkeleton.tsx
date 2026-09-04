import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-in for `MintForm` while the first rate read is still in flight (B12 —
 * Mint had no loading state at all). It mirrors the real card one for one: same
 * shell, same two amount boxes, same rate row, same field, same CTA, so nothing
 * moves when the data lands.
 *
 * `animate-pulse` is gone (C9): a pulse blinks the whole card, `Skeleton` sweeps
 * a highlight across it and reads as "in progress" rather than as a fault. The
 * labels are NOT skeletons on purpose — the user should be able to tell what is
 * being loaded while they wait (B.12).
 */
export function MintFormSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-border bg-card p-5"
    >
      <Skeleton className="h-6 w-40" />

      <div className="flex flex-col gap-4">
        {/* Two amount boxes: label, then the chip + value row. */}
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-4 rounded-xl bg-muted p-4">
              <Skeleton className="h-3.5 w-22" />
              <div className="flex items-center justify-between gap-2">
                <Skeleton shape="circle" className="h-11 w-28" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          ))}
        </div>

        {/* Exchange rate: the label stays real text-height, the value waits. */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-36" />
        </div>

        {/* Destination address: label row + the 44 px field. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton shape="block" className="h-11 w-full" />
        </div>
      </div>

      <Skeleton shape="block" className="h-11 w-full" />
    </div>
  );
}
