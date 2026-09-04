"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/**
 * InputGroup — an Input with something attached to it: a search or wallet icon,
 * a currency chip, a "Maks" chip, the password eye, a copy button.
 *
 * The group owns the border, the height and the focus ring; the control inside
 * is stripped bare so there is never a box inside a box. Addon icons are 16 px
 * and sit 8 px from the text.
 *
 * Buttons in an addon are real `Button`s at 32 px (`sm` / `icon-sm`) — the
 * 24 px sizes shadcn ships with are below this system's smallest control and
 * are not offered here.
 */
const inputGroupSizes = {
  lg: "h-11",
  md: "h-10",
} as const

function InputGroup({
  className,
  size = "lg",
  ...props
}: React.ComponentProps<"div"> & { size?: keyof typeof inputGroupSizes }) {
  return (
    <div
      data-slot="input-group"
      data-size={size}
      role="group"
      className={cn(
        "group/input-group relative flex w-full min-w-0 items-center rounded-lg border border-input bg-card dark:bg-input/30",
        inputGroupSizes[size],
        "transition-control outline-none has-[>textarea]:h-auto",
        // Alignment variants.
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
        // Focus and error live on the group, not on the bare control inside it.
        "has-[[data-slot=input-group-control]:focus-visible]:border-focus-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-focus-ring",
        "has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  [
    "flex h-auto cursor-text items-center justify-center gap-2 text-sm leading-5 text-muted-text select-none",
    "group-data-[disabled=true]/input-group:opacity-50",
    "[&>svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      align: {
        "inline-start": "order-first pl-3 has-[>button]:pl-1.5",
        "inline-end": "order-last pr-3 has-[>button]:pr-1.5",
        "block-start": "order-first w-full justify-start px-3 pt-3",
        "block-end": "order-last w-full justify-start px-3 pb-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      className={cn("shadow-none", className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-text"
      className={cn(
        "flex items-center gap-2 text-sm leading-5 text-muted-text",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "h-full flex-1 rounded-none border-0 bg-transparent focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
        "pointer-fine:hover:border-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-3 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
