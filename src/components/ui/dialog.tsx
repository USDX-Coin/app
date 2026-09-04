"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLang } from "@/providers/LanguageProvider"
import { springSurface } from "@/lib/motion"
import {
  Dialog as DialogPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogOverlay as DialogOverlayPrimitive,
  DialogPortal as DialogPortalPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from "@/components/animate-ui/primitives/radix/dialog"

/**
 * Dialog — two widths for every modal in the product: 448 for a decision or a
 * short form, 512 for a long list. On a phone it is the screen minus 32 px.
 *
 * The body is the only part that scrolls. Header and footer are pinned by
 * `grid-rows-[auto_1fr_auto]`, so a twelve-entry address book cannot push
 * "Tambah wallet" off the bottom of the screen the way it used to.
 *
 * Motion comes from `motion` via Animate UI, which is what gives it a real exit
 * animation; the CSS `animate-in`/`zoom-*` classes that used to live here are
 * gone, because two engines on one component produce a blink followed by a
 * slide. No blur and no 3-D rotation — the stock Animate UI look is overridden
 * on purpose.
 */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive>) {
  return <DialogPrimitive {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogTriggerPrimitive>) {
  return <DialogTriggerPrimitive {...props} />
}

function DialogPortal(props: React.ComponentProps<typeof DialogPortalPrimitive>) {
  return <DialogPortalPrimitive {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogClosePrimitive>) {
  return <DialogClosePrimitive {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogOverlayPrimitive>) {
  return (
    <DialogOverlayPrimitive
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-50 bg-black/50", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    />
  )
}

const dialogSizes = {
  /** Confirmation, form of four fields or fewer, picker, gate, scanner. */
  md: "sm:max-w-md",
  /** Long lists only. */
  lg: "sm:max-w-lg",
} as const

function DialogContent({
  className,
  children,
  size = "md",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogContentPrimitive> & {
  size?: keyof typeof dialogSizes
  showCloseButton?: boolean
}) {
  const { t } = useLang()

  return (
    <DialogPortal>
      <DialogOverlay />
      {/* The wrapper does the centring and the 16 px inset, so the panel itself
          only has to animate opacity, y and scale — no fighting with a
          -translate-1/2 that motion would overwrite. */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogContentPrimitive
          data-slot="dialog-content"
          className={cn(
            "pointer-events-auto grid max-h-[calc(100dvh-2rem)] w-full grid-rows-[auto_1fr_auto]",
            "rounded-2xl border bg-popover text-popover-foreground shadow-lg outline-none",
            dialogSizes[size],
            className
          )}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={springSurface}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogClosePrimitive
              data-slot="dialog-close"
              aria-label={t("common.close")}
              className={cn(
                "absolute top-4 right-4 flex size-8 items-center justify-center rounded-md",
                "text-muted-text transition-control outline-none",
                "pointer-fine:hover:bg-accent pointer-fine:hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-focus-ring",
                // 32 px drawn, 44 px tappable — the invisible ring does the work.
                "after:absolute after:-inset-1.5 after:content-['']"
              )}
            >
              <XIcon className="size-4" />
            </DialogClosePrimitive>
          )}
        </DialogContentPrimitive>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex items-center gap-3 py-4 pr-4 pl-6", className)}
      {...props}
    />
  )
}

/**
 * The scrolling half of the dialog. The hairlines top and bottom only appear
 * once there is something below the fold — a divider on a dialog that fits is
 * decoration, on one that scrolls it is information.
 */
function DialogBody({ className, children, ...props }: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScrollable(el.scrollHeight > el.clientHeight + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [children])

  return (
    <div
      ref={ref}
      data-slot="dialog-body"
      data-scrollable={scrollable}
      className={cn(
        "flex flex-col gap-3 overflow-y-auto px-6 pb-2",
        "data-[scrollable=true]:border-y data-[scrollable=true]:border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("flex gap-3 p-6", className)} {...props} />
}

/** Heading/Kartu 18/28, sentence case. */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      data-slot="dialog-title"
      className={cn("text-lg leading-7 font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      data-slot="dialog-description"
      className={cn("text-sm leading-5 text-muted-text", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
