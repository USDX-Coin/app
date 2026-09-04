import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-in for the history table. It follows the same `lg` breakpoint as
 * `TransactionList` (A2) — a skeleton that flips to cards at a different width
 * than the real thing makes the page jump on the first paint after loading.
 *
 * `bg-white` is gone (A5) and `animate-pulse` with it: `Skeleton` sweeps a
 * highlight rather than blinking the whole card (B.12).
 */
export function TransactionListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Segmented filter, right-aligned like the real one. */}
      <div className="flex justify-end">
        <Skeleton shape="block" className="h-10 w-56" />
      </div>

      {/* Desktop table — mirrors the 9-column history table. */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-9 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-14" />
            ))}
          </div>
          <div className="border-t border-border" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-9 gap-4">
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-16" />
              ))}
              <Skeleton shape="circle" className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile / tablet cards. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton shape="circle" className="h-5 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
