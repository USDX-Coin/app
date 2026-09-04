"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { springSnappy } from "@/lib/motion"
import {
  Tabs as TabsPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsContents as TabsContentsPrimitive,
  TabsHighlight,
  TabsHighlightItem,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from "@/components/animate-ui/primitives/radix/tabs"

/**
 * Tabs — used here as a segmented control (Semua / Mint / Redeem), replacing a
 * hand-rolled dropdown that had no role, no Escape and no arrow keys. Three
 * options that are always visible are quicker to read than a menu that hides
 * two of them.
 *
 * The highlight slides with `springSnappy`; content cross-fades. No
 * `animate-in` classes — tabs are not an overlay, and one component gets one
 * animation engine.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive>) {
  return (
    <TabsPrimitive
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsListPrimitive>) {
  return (
    <TabsHighlight
      transition={springSnappy}
      className="absolute inset-0 z-0 rounded-md bg-card shadow-sm dark:bg-input/50 dark:shadow-none"
    >
      <TabsListPrimitive
        data-slot="tabs-list"
        className={cn(
          "inline-flex h-10 w-fit items-center justify-center gap-1 rounded-lg bg-muted p-1",
          className
        )}
        {...props}
      >
        {children}
      </TabsListPrimitive>
    </TabsHighlight>
  )
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<typeof TabsTriggerPrimitive>) {
  return (
    <TabsHighlightItem value={value as string} className="flex-1">
      <TabsTriggerPrimitive
        data-slot="tabs-trigger"
        value={value}
        className={cn(
          "relative z-1 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md px-3",
          "text-sm leading-5 font-medium whitespace-nowrap text-muted-text",
          "transition-control outline-none",
          "data-[state=active]:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-focus-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        {...props}
      >
        {children}
      </TabsTriggerPrimitive>
    </TabsHighlightItem>
  )
}

function TabsContents(props: React.ComponentProps<typeof TabsContentsPrimitive>) {
  return <TabsContentsPrimitive data-slot="tabs-contents" {...props} />
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsContentPrimitive>) {
  return (
    <TabsContentPrimitive
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      // Cross-fade only. The primitive's stock 4 px blur is switched off — a
      // blurred panel reads as a rendering fault, not as motion.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsContents }
