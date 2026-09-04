"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLang } from "@/providers/LanguageProvider"
import { springSurface } from "@/lib/motion"
import {
  Sheet as SheetPrimitive,
  SheetClose as SheetClosePrimitive,
  SheetContent as SheetContentPrimitive,
  SheetDescription as SheetDescriptionPrimitive,
  SheetOverlay as SheetOverlayPrimitive,
  SheetPortal as SheetPortalPrimitive,
  SheetTitle as SheetTitlePrimitive,
  SheetTrigger as SheetTriggerPrimitive,
} from "@/components/animate-ui/primitives/radix/sheet"

/**
 * Sheet — the mobile navigation drawer (272, the same width as the desktop
 * sidebar) and the transaction detail panel (320).
 *
 * Only the middle scrolls. On a 320×568 screen the nav gets about 414 px, which
 * is not enough for every item — but the footer stays pinned, so Bahasa and
 * Tema are always reachable instead of being buried under a list.
 *
 * `overscroll-contain` stops a flick inside the drawer from scrolling the page
 * behind it, and the footer keeps `env(safe-area-inset-bottom)` so the last row
 * is not sitting under an iPhone's home indicator. The footer height is `auto`
 * on purpose — pinning it is what creates safe-area bugs on notched devices.
 */
function Sheet(props: React.ComponentProps<typeof SheetPrimitive>) {
  return <SheetPrimitive {...props} />
}

function SheetTrigger(props: React.ComponentProps<typeof SheetTriggerPrimitive>) {
  return <SheetTriggerPrimitive {...props} />
}

function SheetClose(props: React.ComponentProps<typeof SheetClosePrimitive>) {
  return <SheetClosePrimitive {...props} />
}

function SheetPortal(props: React.ComponentProps<typeof SheetPortalPrimitive>) {
  return <SheetPortalPrimitive {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetOverlayPrimitive>) {
  return (
    <SheetOverlayPrimitive
      data-slot="sheet-overlay"
      className={cn("fixed inset-0 z-50 bg-black/50", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetContentPrimitive> & {
  showCloseButton?: boolean
}) {
  const { t } = useLang()

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetContentPrimitive
        data-slot="sheet-content"
        side={side}
        transition={springSurface}
        className={cn(
          "z-50 grid h-full grid-rows-[auto_1fr_auto] bg-popover text-popover-foreground shadow-lg outline-none",
          // A panel that runs the full height of the screen has no corners to round.
          side === "left" && "w-68 max-w-[85vw] border-r",
          side === "right" && "w-80 max-w-[85vw] border-l",
          (side === "top" || side === "bottom") && "h-auto w-full",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetClosePrimitive
            data-slot="sheet-close"
            aria-label={t("common.close")}
            className={cn(
              "absolute top-3 right-3 flex size-8 items-center justify-center rounded-md",
              "text-muted-text transition-control outline-none",
              "pointer-fine:hover:bg-accent pointer-fine:hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-focus-ring",
              "after:absolute after:-inset-1.5 after:content-['']"
            )}
          >
            <XIcon className="size-4" />
          </SheetClosePrimitive>
        )}
      </SheetContentPrimitive>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex h-14 shrink-0 items-center gap-3 border-b border-border py-3 pr-3 pl-5", className)}
      {...props}
    />
  )
}

/** The only scrolling part. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex flex-col gap-1 border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  )
}

/** Heading/Kartu 18/28. */
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitlePrimitive>) {
  return (
    <SheetTitlePrimitive
      data-slot="sheet-title"
      className={cn("text-lg leading-7 font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetDescriptionPrimitive>) {
  return (
    <SheetDescriptionPrimitive
      data-slot="sheet-description"
      className={cn("text-sm leading-5 text-muted-text", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
