"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * RadioGroup — an exclusive choice. Plain Radix, no motion: a radio has no
 * surface to move, and a dot that springs into place reads as a glitch.
 *
 * ── Arrow keys must MOVE THE CHOICE, not just the focus ──────────────────────
 * That is the WAI-ARIA radio pattern, and it is the whole reason this component
 * replaced the hand-rolled tiles. Radix intends to do it: on focus it calls
 * `.click()` if an arrow key is down. But it learns "an arrow key is down" from
 * a `document.addEventListener('keydown')` registered in an effect, and React
 * delegates its own events at the root container, which is *inside* document.
 * So the whole React chain — roving focus moves focus, focus handler runs — has
 * already finished by the time that document listener fires. The ref is still
 * false, the click never happens, and arrows only ever move focus.
 *
 * The consequence is not cosmetic. In the light theme the focus ring and the
 * selected marker are both maroon, so a keyboard user could arrow onto a
 * different bank, see a maroon ring on it, and pay — while the selected account
 * was still the previous one.
 *
 * Patching only Radix's trigger was not enough — measured in Chromium, the
 * selection then lagged the focus by one press and arrow navigation stopped
 * altogether once a click landed inside the focus handler, because clicking
 * changes which item roving focus considers active. So this component owns the
 * arrow keys outright: it intercepts them in the capture phase, moves focus and
 * selects in one step, and never lets roving focus see them.
 *
 * Everything else is left to Radix: Tab in/out and the roving tabindex still
 * work because we move focus with `.focus()`, and Space and mouse clicks are
 * untouched — they were never broken.
 *
 * Assumes LTR. In an RTL locale left/right would need swapping; the product is
 * Indonesian, and there is no RTL surface to test against yet.
 */
const ARROW_NEXT = new Set(["ArrowDown", "ArrowRight"])
const ARROW_PREV = new Set(["ArrowUp", "ArrowLeft"])

function RadioGroup({
  className,
  onKeyDownCapture,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      onKeyDownCapture={(event) => {
        onKeyDownCapture?.(event)
        if (event.defaultPrevented) return

        const step = ARROW_NEXT.has(event.key) ? 1 : ARROW_PREV.has(event.key) ? -1 : 0
        if (step === 0) return

        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "[data-slot=radio-group-item]:not([disabled])"
          )
        )
        if (items.length === 0) return

        const focused = items.indexOf(document.activeElement as HTMLButtonElement)
        const checked = items.findIndex((el) => el.getAttribute("aria-checked") === "true")
        const from = focused !== -1 ? focused : checked !== -1 ? checked : 0
        const next = items[(from + step + items.length) % items.length]

        // Take the key away from roving focus: it would move focus without
        // moving the choice, which is the bug this exists to prevent.
        event.preventDefault()
        event.stopPropagation()
        next.focus()
        next.click()
      }}
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "relative aspect-square size-5 shrink-0 rounded-full border border-input bg-card",
        "transition-control outline-none dark:bg-input/30",
        "pointer-fine:hover:border-foreground/25",
        // `primary-text`, not `primary`: #800000 on a dark card is 1,59:1, so a
        // selected radio was all but invisible at night — the one state that
        // must never be in doubt.
        "data-[state=checked]:border-[1.5px] data-[state=checked]:border-primary-text data-[state=checked]:pointer-fine:hover:border-primary-text",
        // The focus ring is detached by a background-coloured gap, so it can
        // never merge with the selected border into one solid maroon edge.
        "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="size-2.5 rounded-full bg-primary-text" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
