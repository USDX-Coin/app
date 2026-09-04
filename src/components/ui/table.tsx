"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Table — 16 px radius on the wrapper, a sticky header, and two row heights:
 * 48 comfortable, 40 compact, switched by `density` on the `<table>`.
 *
 * A cell is NOT a container query container, even though that was the plan.
 * Measured in Chromium: `container-type: inline-size` on a `<td>` registers the
 * name but never answers a query, because size containment does not apply to
 * internal table elements. It looked correct and did nothing. If a cell's
 * contents ever need to respond to column width, wrap them in a `<div>` inside
 * the cell and put the container on that — a real element, not a table part.
 */

function Table({
  className,
  density = "comfortable",
  scrollLabel = "Tabel, dapat digulir ke samping",
  ...props
}: React.ComponentProps<"table"> & {
  density?: "comfortable" | "compact"
  /** Label wadah gulir untuk pembaca layar. Timpa dengan nama tabelnya. */
  scrollLabel?: string
}) {
  return (
    <div
      data-slot="table-container"
      // Wadah ini menggulir horizontal saat kolomnya lebih lebar dari layar, jadi ia
      // harus bisa dijangkau keyboard (WCAG 2.1.1). Tanpa `tabIndex`, isi yang tergulir
      // hanya terjangkau oleh mouse. `role="region"` + label memberi tahu screen reader
      // apa yang sedang digulir.
      tabIndex={0}
      role="region"
      aria-label={scrollLabel}
      className="relative w-full overflow-x-auto rounded-2xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    >
      <table
        data-slot="table"
        data-density={density}
        className={cn("group/table w-full caption-bottom text-sm leading-5", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-1 bg-card [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-control data-[state=selected]:bg-muted",
        "pointer-fine:hover:bg-muted/50",
        "group-data-[density=comfortable]/table:h-12 group-data-[density=compact]/table:h-10",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-left align-middle text-xs leading-4 font-medium whitespace-nowrap text-muted-text [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-text", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
