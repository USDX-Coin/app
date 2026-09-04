import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Empty — the state a card shows instead of data.
 *
 * Figma calls the property `jenis`; in code it is `kind`, with four values:
 * kosong→empty · filter→filter · gagal→error · offline→offline.
 *
 * `filter` is the odd one out and shows no media at all: nothing happened, the
 * user simply narrowed the list. "Stale data" is not an Empty either — the old
 * rows stay on screen with a warning strip above them.
 *
 * 240 px minimum height so a card does not jump when it moves from skeleton to
 * Empty to data.
 */
function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-60 w-full min-w-0 flex-col items-center justify-center gap-4 px-6 py-8 text-center text-balance",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "flex size-12 shrink-0 items-center justify-center rounded-full [&_svg]:pointer-events-none [&_svg]:size-5",
  {
    variants: {
      kind: {
        empty: "bg-muted text-muted-text",
        // No circle, no icon: a filtered-out list is not an event.
        filter: "hidden",
        error: "bg-destructive/12 text-destructive-text",
        offline: "bg-muted text-muted-text",
      },
    },
    defaultVariants: {
      kind: "empty",
    },
  }
)

function EmptyMedia({
  className,
  kind,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-media"
      data-kind={kind}
      aria-hidden
      className={cn(emptyMediaVariants({ kind, className }))}
      {...props}
    />
  )
}

/**
 * Heading/Seksi 16/24, sentence case. No "sepertinya", no apology.
 *
 * `as` ada karena Empty sering MENJADI seluruh isi halaman (404, error.tsx,
 * verify-email). Sebagai <div> halaman itu tidak punya heading sama sekali dan
 * pembaca layar kehilangan penanda halaman — jadi lewatkan `as="h1"` di sana.
 * Tetap <div> secara bawaan: di dalam kartu atau tabel, Empty bukan judul halaman.
 */
function EmptyTitle({
  className,
  as: Comp = "div",
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "h1" | "h2" | "h3" }) {
  return (
    <Comp
      data-slot="empty-title"
      className={cn("text-base leading-6 font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn(
        "text-sm leading-5 text-muted-text [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

/** Holds the CTA. "Coba lagi" calls `refetch()` — it never reloads the page. */
function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("flex w-full max-w-sm min-w-0 flex-col items-center gap-4", className)}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  emptyMediaVariants,
}
