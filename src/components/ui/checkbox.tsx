"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Checkbox as CheckboxPrimitive,
  CheckboxIndicator,
} from "@/components/animate-ui/primitives/radix/checkbox"

/**
 * Checkbox — 20 px box, 44 px touch target.
 *
 * The box stays 20 px; it is the *label* that grows the hit area to 44, so the
 * control keeps its drawn size while still being tappable (finding E1).
 *
 * The tick is drawn rather than faded in — `pathLength` over 200 ms — and skips
 * straight to drawn under reduced motion. The primitive's stock `whileHover`
 * scale 1.05 / `whileTap` 0.95 are switched off here: nothing in this app grows
 * under the cursor.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive>) {
  return (
    <CheckboxPrimitive
      data-slot="checkbox"
      whileHover={undefined}
      whileTap={undefined}
      className={cn(
        "peer flex size-5 shrink-0 items-center justify-center rounded-md border border-input bg-card",
        "transition-control outline-none",
        "pointer-fine:hover:not-data-[state=checked]:border-foreground/25",
        // `primary-text`, not `primary`: the maroon fill is 1,59:1 on a dark
        // card, so a ticked box faded into the surface. The tick takes the
        // page colour so it reads on both values of that fill.
        "data-[state=checked]:border-primary-text data-[state=checked]:bg-primary-text data-[state=checked]:text-background",
        // Detached by a background-coloured gap so the focus ring never reads
        // as the box's own edge — focus and checked must not look alike.
        "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxIndicator className="size-3.5 motion-reduce:transition-none" />
    </CheckboxPrimitive>
  )
}

/**
 * The row a checkbox lives in. `min-h-11` belongs here, not on the box: the
 * target is 44 px, the drawn control is 20.
 */
function CheckboxField({
  className,
  htmlFor,
  children,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="checkbox-field"
      htmlFor={htmlFor}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center gap-2 py-2 text-sm leading-5",
        "has-[[data-slot=checkbox]:disabled]:cursor-not-allowed has-[[data-slot=checkbox]:disabled]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}

export { Checkbox, CheckboxField }
