import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Card — elevation 0. A card is a surface, not a floating panel: background,
 * border, no shadow. Shadows belong to things that hover over the page
 * (dropdown, dialog), and shadcn's stock `shadow-sm` is dropped here.
 *
 * Three radii, always one step apart: 16 card · 12 inner box · 8 control.
 * Cards do not nest more than one level — `default` may hold `inner`, and if a
 * third level is needed the page wants splitting instead.
 */
const cardVariants = cva("flex flex-col text-card-foreground", {
  variants: {
    variant: {
      default: "gap-4 rounded-2xl border bg-card p-5 md:p-6",
      /** A box inside a card: fee breakdown, amount box, notice. */
      inner: "gap-3 rounded-xl bg-muted p-4",
      /** Balance card. Maroon gradient, same in both themes. */
      brand: "gap-3 rounded-lg border border-white/20 balance-gradient p-3 text-white",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-variant={variant ?? "default"}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

/** Heading/Kartu 18/28, sentence case — "Ringkasan transaksi", not Title Case. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-lg leading-7 font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm leading-5 text-muted-text", className)}
      {...props}
    />
  )
}

/** Top-right slot. Always a `Button variant="ghost" size="sm"` (32 px). */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex flex-col gap-3", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-3", className)} {...props} />
}

/** One label–value line inside a card: 20 px tall, 12 px gap, numbers aligned. */
function CardRow({
  className,
  label,
  children,
  ...props
}: React.ComponentProps<"div"> & { label: React.ReactNode }) {
  return (
    <div
      data-slot="card-row"
      className={cn("flex min-h-5 items-center justify-between gap-3", className)}
      {...props}
    >
      <span className="text-sm leading-5 text-muted-text">{label}</span>
      <span className="text-sm leading-5 font-medium tabular-nums">{children}</span>
    </div>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardRow,
  cardVariants,
}
