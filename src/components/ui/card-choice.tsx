"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { RadioGroupItem } from "@/components/ui/radio-group"

/**
 * CardChoice — a whole card that acts as the label for one radio.
 *
 * ── Why `@container` and not a breakpoint ────────────────────────────────────
 * This is the first component in the codebase to use a container query, so the
 * reasoning is written here once.
 *
 * On the Register screen two of these cards sit side by side, which makes each
 * one about 218 px wide — on a *desktop*. A viewport breakpoint asks "how wide
 * is the window", and the window is 1280 px, so `md:` and friends all answer
 * "plenty of room" and the "SEGERA HADIR" badge eats the whole title row,
 * leaving roughly 35 px for the text. `@container` asks the only question that
 * matters here: how wide is *this card*. Below 300 px the badge drops to its
 * own line instead of squeezing the title.
 *
 * The same reasoning applies to `Alert`, `StatusBadge` and table cells: every
 * one of them can be narrow inside a wide window. Tailwind v4 supports this
 * with no plugin.
 *
 * The badge stays at full opacity while the card is disabled — it is the thing
 * that explains *why* the card is dead, so dimming it hides the answer.
 */
function CardChoice({
  className,
  value,
  title,
  description,
  icon,
  badge,
  disabled = false,
  id,
  ...props
}: Omit<React.ComponentProps<"label">, "title"> & {
  value: string
  title: React.ReactNode
  description?: React.ReactNode
  /** 32×32 frame on the right. Ignored when a badge is shown — the badge takes its place. */
  icon?: React.ReactNode
  /** Feature label, e.g. "Segera hadir". Pass `false` to fall back to the description. */
  badge?: React.ReactNode | false
  disabled?: boolean
}) {
  const itemId = id ?? `choice-${value}`
  const showBadge = badge !== undefined && badge !== false && badge !== null

  return (
    <label
      data-slot="card-choice"
      htmlFor={itemId}
      data-disabled={disabled || undefined}
      className={cn(
        "@container/choice group relative flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4",
        "transition-control",
        disabled ? "cursor-not-allowed" : "cursor-pointer pointer-fine:hover:border-foreground/25",
        // 2 px maroon + a 5 % wash. `primary-text`, not `primary`: #800000 on a
        // dark card is 1,59:1 and the selected border would vanish at night.
        "has-data-[state=checked]:border-2 has-data-[state=checked]:border-primary-text has-data-[state=checked]:bg-primary-text/5",
        // The card is the label, so the focus ring goes round the whole card —
        // but detached by a background-coloured gap. Without the gap a 2 px
        // maroon ring sits flush against the 2 px maroon border of the selected
        // state and the two read as one edge: "focused" and "chosen" become
        // indistinguishable, which on a bank tile means paying the wrong account.
        "has-[[data-slot=radio-group-item]:focus-visible]:ring-2 has-[[data-slot=radio-group-item]:focus-visible]:ring-focus-ring",
        "has-[[data-slot=radio-group-item]:focus-visible]:ring-offset-2 has-[[data-slot=radio-group-item]:focus-visible]:ring-offset-background",
        className
      )}
      {...props}
    >
      <RadioGroupItem
        id={itemId}
        value={value}
        disabled={disabled}
        className={cn("focus-visible:ring-0", disabled && "opacity-50")}
      />

      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          data-slot="card-choice-text"
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 @max-[300px]/choice:basis-full",
            disabled && "opacity-50"
          )}
        >
          {/* min-w-0 so `truncate` bites on the title and never on the badge. */}
          <span className="min-w-0 truncate text-sm leading-5 font-medium">{title}</span>
          {description && (
            <span className="text-xs leading-4 text-muted-text">{description}</span>
          )}
        </span>

        {showBadge && (
          <Badge tone="coming-soon" className="shrink-0">
            {badge}
          </Badge>
        )}
      </span>

      {icon && !showBadge && (
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center text-muted-text [&_svg]:size-4",
            disabled && "opacity-50"
          )}
        >
          {icon}
        </span>
      )}
    </label>
  )
}

export { CardChoice }
