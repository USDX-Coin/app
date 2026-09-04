import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input — 44 px in a form, 40 px in a filter or a table cell.
 *
 * There is exactly one `<input>` in this tree and it is never branched on a
 * visual state. `disabled`, `readonly`, `aria-invalid` and a loading overlay
 * change classes and attributes only; the value the caller passed in is the
 * value the user sees, in every state. (A field whose number changes when it
 * goes disabled is a first-class bug in an app that moves money.)
 *
 * `readonly` is not `disabled`: it keeps full contrast and stays selectable, so
 * a VA number or a wallet address can still be read and copied.
 */
const inputSizes = {
  /** Form fields — the default. */
  lg: "h-11",
  /** Filters, table cells, anything inside a dense row. */
  md: "h-10",
} as const

function Input({
  className,
  type,
  size = "lg",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: keyof typeof inputSizes
}) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        inputSizes[size],
        "w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 dark:bg-input/30",
        // 16 px on mobile — anything smaller makes iOS zoom the page on focus.
        "text-base md:text-sm",
        "transition-control outline-none",
        "selection:bg-primary selection:text-primary-foreground",
        "placeholder:text-muted-text",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Hover only where there is a real pointer; a tap must not leave a hover border behind.
        "pointer-fine:hover:border-foreground/25",
        "focus-visible:border-focus-ring focus-visible:ring-2 focus-visible:ring-focus-ring",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "aria-invalid:focus-visible:ring-destructive",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-input disabled:bg-muted disabled:text-muted-text",
        "read-only:border-transparent read-only:bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Input }
