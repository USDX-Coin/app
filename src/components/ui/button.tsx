import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

/**
 * Button — five variants, three heights.
 *
 * shadcn's `default` and `secondary` variants are gone on purpose: two maroons
 * that differ by a hair were the reason the same action looked different on two
 * screens. `brand` is the only filled maroon; everything else is outline, ghost,
 * destructive or link.
 *
 * Heights are the only sanctioned control scale — 32 / 40 / 44. Icons inside a
 * button are always 16 px, at every size.
 *
 * Hover is gated behind `pointer-fine:` so a tap on touch does not leave the
 * button stuck in its hover colour.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg",
    "text-sm font-medium whitespace-nowrap transition-control outline-none",
    "focus-visible:ring-2 focus-visible:ring-focus-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        // The white top-highlight lives in `.brand-gradient`; hover adds a flat
        // 8% white film on top of it. Not `opacity-95` — dimming the whole
        // button also dims the label, which is the part that must stay legible.
        brand: [
          "brand-gradient text-primary-foreground",
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-white/0 after:transition-control",
          "pointer-fine:hover:after:bg-white/8",
          "active:translate-y-px active:brightness-95",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ],
        outline: [
          "border border-border bg-card text-foreground",
          "pointer-fine:hover:bg-accent",
          "active:bg-accent/80",
        ],
        ghost: ["text-foreground", "pointer-fine:hover:bg-accent", "active:bg-accent/80"],
        // Opaque surface with its own token, and hover/active that change
        // brightness instead of opacity. `bg-destructive/80` let the page show
        // through, which dropped the white label to 3,78:1 — the very failure
        // this variant is meant to avoid. Brightness moves the surface *away*
        // from the label's luminance in both themes (darker under a white
        // label, lighter under a near-black one), so every state is at least as
        // legible as the default.
        destructive: [
          "bg-destructive-surface text-destructive-foreground",
          "pointer-fine:hover:brightness-90 dark:pointer-fine:hover:brightness-110",
          "active:brightness-80 dark:active:brightness-120",
          // A maroon ring on a red button needs a gap to read as a ring.
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ],
        // Standalone link — keeps a button's padding so it lines up with the
        // controls around it. For a link inside a sentence use `LinkInline`.
        link: [
          "rounded-sm text-primary-text underline-offset-4",
          "pointer-fine:hover:underline",
        ],
      },
      size: {
        sm: "h-8 px-3",
        default: "h-10 px-4",
        lg: "h-11 px-6",
        // Touch pointers get 44; a mouse gets 40. Same element, no prop to remember.
        icon: "size-10 p-0 pointer-coarse:size-11",
        "icon-sm": "size-8 p-0",
      },
    },
    defaultVariants: {
      variant: "brand",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Mutation in flight: spinner + `aria-busy`, and the button stops responding. */
    loading?: boolean
    /** What the button says while loading — "Memproses…", "Menyimpan…". */
    loadingLabel?: React.ReactNode
    /** Seconds left on a 429 cooldown. Non-zero disables the button. */
    cooldownSeconds?: number
    /** Already-localised cooldown text, e.g. t("auth.tryAgainIn", { n }). */
    cooldownLabel?: React.ReactNode
    /** Feature not shipped yet: disabled, with the badge shown *inside* the button. */
    comingSoon?: boolean
    /** Badge copy for `comingSoon`. Indonesian by default; pass t() to translate. */
    comingSoonLabel?: React.ReactNode
  }

function Button({
  className,
  variant = "brand",
  size = "default",
  asChild = false,
  loading = false,
  loadingLabel,
  cooldownSeconds,
  cooldownLabel,
  comingSoon = false,
  comingSoonLabel = "Segera hadir",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const cooling = (cooldownSeconds ?? 0) > 0
  // While the button is busy its label is replaced, but its width must not move —
  // a footer button that shrinks mid-submit reads as a layout bug.
  const busyLabel = loading ? loadingLabel : cooling ? cooldownLabel : undefined

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={Comp === "button" ? disabled || loading || cooling || comingSoon : undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : busyLabel === undefined ? (
        <>
          {loading && <Spinner className="size-4" aria-hidden />}
          {children}
          {comingSoon && <ComingSoonBadge>{comingSoonLabel}</ComingSoonBadge>}
        </>
      ) : (
        <>
          <span className="invisible inline-flex items-center gap-2" aria-hidden>
            {children}
          </span>
          <span className="absolute inset-0 inline-flex items-center justify-center gap-2 px-3">
            {loading && <Spinner className="size-4" aria-hidden />}
            {busyLabel}
          </span>
        </>
      )}
    </Comp>
  )
}

/** Feature-not-shipped-yet pill. Label/Badge: 12/16, medium, tracking 0,3. */
function ComingSoonBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gold px-2 py-0.5 text-xs leading-4 font-medium tracking-wide text-on-gold">
      {children}
    </span>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
