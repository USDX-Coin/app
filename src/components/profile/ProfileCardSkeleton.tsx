import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-in for `ProfileCard` while /auth/me is still in flight and nothing is
 * cached (B12). It mirrors the real page one-to-one — heading, three cards, the
 * same paddings — so the switch to data does not move anything.
 *
 * `bg-white` is gone (A4): the surface is `Card`, which follows the theme.
 * `animate-pulse` is gone too — `Skeleton` sweeps a highlight instead of
 * blinking the whole card (B.12).
 */
export function ProfileCardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Skeleton className="h-8 w-28" />

      {/* Personal information: title + KYC pill, then four label/value pairs. */}
      <Card>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton shape="circle" className="h-5 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton shape="circle" className="mt-0.5 size-4" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Security: title + one row that ends in the "Ganti Password" button. */}
      <Card>
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton shape="block" className="h-10 w-36 shrink-0" />
        </div>
      </Card>

      {/* Preferences: title + one label/value pair. */}
      <Card>
        <Skeleton className="h-5 w-32" />
        <div className="flex items-start gap-3">
          <Skeleton shape="circle" className="mt-0.5 size-4" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </Card>
    </div>
  );
}
