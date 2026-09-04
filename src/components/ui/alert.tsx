import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Alert — a state that persists on screen: failed to load, offline, stale data,
 * KYC not finished. (A one-off event that just happened is a Toast; a wrong
 * value in a form is a FieldError.)
 *
 * Two properties, `tone` × `shape` — Figma calls them `nada` × `bentuk`:
 * info · sukses→success · peringatan→warning · bahaya→danger, and blok→block ·
 * strip→strip.
 *
 * The tint formula never changes: background at 10 % of the tone, border at
 * 30 %. The description stays `text-foreground`; two tone colours stacked in
 * one block make the text hard to read on top of the tint.
 */
const alertVariants = cva("relative w-full text-sm", {
  variants: {
    tone: {
      info: "border-info/30 bg-info/10",
      success: "border-success/30 bg-success/10",
      warning: "border-warning/30 bg-warning/10",
      danger: "border-destructive/30 bg-destructive/10",
    },
    shape: {
      /** Lives inside a card. 12 px radius, one column of text. */
      block: "flex gap-3 rounded-xl border px-4 py-3",
      /** A thin line above a card or a form. 8 px radius, one line of text. */
      strip: "@container/alert flex items-center gap-2 rounded-lg border px-3 py-2",
    },
  },
  defaultVariants: {
    tone: "info",
    shape: "block",
  },
})

const toneTitle = {
  info: "text-info-text",
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-destructive-text",
} as const

const toneIcon = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const

type AlertProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode
    /** Always an outline `sm` button — an Alert is not a place for a brand CTA. */
    action?: React.ReactNode
    icon?: React.ReactNode
  }

function Alert({
  className,
  tone = "info",
  shape = "block",
  title,
  action,
  icon,
  children,
  ...props
}: AlertProps) {
  const ToneIcon = toneIcon[tone ?? "info"]

  return (
    <div
      data-slot="alert"
      data-tone={tone}
      data-shape={shape}
      role="alert"
      className={cn(alertVariants({ tone, shape }), className)}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 [&_svg]:size-4",
          // 8 px down so the glyph sits on the title's baseline, not above it.
          shape === "block" && "pt-2",
          toneTitle[tone ?? "info"]
        )}
      >
        {icon ?? <ToneIcon />}
      </span>

      {shape === "block" ? (
        <div className="flex min-w-0 flex-1 flex-col">
          {title && (
            <p
              data-slot="alert-title"
              className={cn("text-sm leading-5 font-medium", toneTitle[tone ?? "info"])}
            >
              {title}
            </p>
          )}
          {children && (
            <div
              data-slot="alert-description"
              className="text-sm leading-5 text-foreground"
            >
              {children}
            </div>
          )}
          {/*
           * The action frame is not rendered at all when there is no action —
           * not rendered empty. An Alert without an action is 66 px tall, with
           * one it is 110; nothing in between, and never 110 with a hole in it.
           *
           * The stack is vertical at every width, desktop included. Putting the
           * button in a right-hand column is what squeezes the description on a
           * narrow card, so there is deliberately no breakpoint here.
           */}
          {action && <div className="pt-3">{action}</div>}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 @max-[18rem]/alert:flex-col @max-[18rem]/alert:items-start">
          <span data-slot="alert-description" className="min-w-0 text-foreground">
            {title ? <span className="font-medium">{title} </span> : null}
            {children}
          </span>
          {action && <span className="shrink-0">{action}</span>}
        </div>
      )}
    </div>
  )
}

/** Kept for the shadcn anatomy; `Alert` renders these itself in normal use. */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("text-sm leading-5 font-medium", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm leading-5 text-foreground", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
export type { AlertProps }
