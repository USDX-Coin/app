import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Badge — a status pill. Six tones, no icons.
 *
 * In a 40–48 px table row a 12 px icon only adds noise; the status already
 * reads from its colour and its word. Text always uses the `*-text` tokens —
 * `--success` and friends are surface values (3,30:1 on white) and fail AA the
 * moment they carry a letter.
 *
 * Figma names the property `nada` and its values in Indonesian; the code keeps
 * English identifiers like the rest of the codebase. The mapping is:
 * sukses→success · peringatan→warning · info→info · bahaya→danger ·
 * netral→neutral · segera-hadir→coming-soon.
 */
const badgeVariants = cva(
  [
    "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2 py-0.5",
    "text-xs leading-4 font-medium tracking-wide whitespace-nowrap",
    "transition-control",
  ],
  {
    variants: {
      tone: {
        success: "bg-success/12 text-success-text",
        warning: "bg-warning/12 text-warning-text",
        info: "bg-info/12 text-info-text",
        danger: "bg-destructive/12 text-destructive-text",
        neutral: "bg-muted text-muted-text",
        // The only solid one, and the only one in caps: it labels a feature,
        // not the state of a piece of data.
        "coming-soon": "bg-gold text-on-gold uppercase",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    /**
     * @deprecated shadcn's old prop, kept only until `Sidebar.tsx` and
     * `ProfileCard.tsx` move to `tone`. Delete both this prop and the map below
     * once they have.
     */
    variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
  }

const legacyVariantTone = {
  default: "neutral",
  secondary: "neutral",
  destructive: "danger",
  outline: "neutral",
  ghost: "neutral",
  link: "neutral",
} as const

function Badge({ className, tone, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"
  const resolved = tone ?? (variant ? legacyVariantTone[variant] : undefined)

  return (
    <Comp
      data-slot="badge"
      data-tone={resolved}
      className={cn(badgeVariants({ tone: resolved }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
