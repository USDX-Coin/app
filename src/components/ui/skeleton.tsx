import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Skeleton — one colour (`--accent`) with a highlight sweeping across it.
 *
 * Not `animate-pulse`: a pulse makes the whole card blink, a shimmer gives the
 * wait a direction. 1,6 s per pass, `ease-standard`, still under reduced motion.
 *
 * `shape` only sets the radius. Size comes from the caller (`h-5 w-24`,
 * `size-10`, `h-11 w-full`) — a skeleton has no size of its own, it borrows the
 * size of whatever it stands in for.
 */
const skeletonVariants = cva(
  [
    "animate-shimmer motion-reduce:animate-none",
    "bg-[linear-gradient(90deg,var(--accent)_25%,var(--skeleton-highlight)_50%,var(--accent)_75%)]",
    "bg-[length:200%_100%]",
  ],
  {
    variants: {
      shape: {
        /** One line of text. */
        line: "rounded-md",
        /** Avatar or icon. */
        circle: "rounded-full",
        /** A field or a button — same 8 px radius as the control it replaces. */
        block: "rounded-lg",
      },
    },
    defaultVariants: {
      shape: "line",
    },
  }
)

function Skeleton({
  className,
  shape,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  )
}

/**
 * Two skeleton lines standing in for a paragraph: the second one stops at 60 %
 * so the block reads as prose rather than as a filled box.
 */
function SkeletonText({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-text"
      className={cn("flex w-full flex-col gap-2", className)}
      {...props}
    >
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  )
}

export { Skeleton, SkeletonText, skeletonVariants }
