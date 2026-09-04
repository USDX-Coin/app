"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/** Toggle — a single on/off control. Heights follow the 32 / 40 / 44 scale. */
const toggleVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-lg",
    "text-sm leading-5 font-medium whitespace-nowrap",
    "transition-control outline-none",
    "pointer-fine:hover:bg-accent",
    "focus-visible:ring-2 focus-visible:ring-focus-ring",
    "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-transparent text-muted-text",
        outline: "border border-input bg-transparent text-foreground",
      },
      size: {
        sm: "h-8 min-w-8 px-3",
        default: "h-10 min-w-10 px-4",
        lg: "h-11 min-w-11 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
