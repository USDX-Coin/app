import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Spinner — 16 px inside a button, 14 px (`size-3.5`) for a background refetch.
 *
 * Decorative by default: the thing that is busy announces itself (`aria-busy`
 * on the button, `aria-live` on the region). A second announcement from the
 * icon only makes the screen reader repeat itself. Pass `aria-label` when the
 * spinner really is the only signal.
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role={props["aria-label"] ? "status" : undefined}
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
