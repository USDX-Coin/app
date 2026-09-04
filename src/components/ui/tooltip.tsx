"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Tooltip as TooltipPrimitive,
  TooltipArrow as TooltipArrowPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipPortal,
  TooltipProvider as TooltipProviderPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from "@/components/animate-ui/primitives/radix/tooltip"

/**
 * Tooltip — a name or a value on hover, nothing more. No actions, and never
 * information the user cannot get any other way: touch has no hover, so the
 * same text is always on the trigger's `aria-label` and the full value is
 * always copyable somewhere.
 *
 * Not for buttons that already show their label — repeating a visible word is
 * noise. It is for icon-only buttons and for truncated values.
 *
 * Colours are inverted against the theme (`bg-foreground` / `text-background`),
 * which is the highest contrast available without inventing a token.
 */
function TooltipProvider({
  delayDuration = 300,
  skipDelayDuration = 100,
  ...props
}: React.ComponentProps<typeof TooltipProviderPrimitive>) {
  return (
    <TooltipProviderPrimitive
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  )
}

/**
 * Carries its own provider so a tooltip works wherever it is dropped. Radix
 * allows nested providers, and a root-level one would still be honoured.
 */
function Tooltip({
  delayDuration,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive data-slot="tooltip" delayDuration={delayDuration} {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipTriggerPrimitive>) {
  return <TooltipTriggerPrimitive data-slot="tooltip-trigger" {...props} />
}

const offsets = {
  top: { y: 4 },
  bottom: { y: -4 },
  left: { x: 4 },
  right: { x: -4 },
} as const

function TooltipContent({
  className,
  children,
  side = "top",
  sideOffset = 4,
  mono = false,
  showArrow = true,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitive> & {
  /** Hashes, VA numbers, wallet addresses — wraps at 280 px. */
  mono?: boolean
  showArrow?: boolean
}) {
  const from = offsets[side as keyof typeof offsets] ?? offsets.top

  return (
    <TooltipPortal>
      <TooltipContentPrimitive
        data-slot="tooltip-content"
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-4 text-background",
          mono && "max-w-[280px] font-mono break-all",
          className
        )}
        initial={{ opacity: 0, scale: 0.98, ...from }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        {...props}
      >
        {children}
        {showArrow && (
          <TooltipArrowPrimitive
            data-slot="tooltip-arrow"
            width={16}
            height={8}
            className="fill-foreground"
          />
        )}
      </TooltipContentPrimitive>
    </TooltipPortal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
