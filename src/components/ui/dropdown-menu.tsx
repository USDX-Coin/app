"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSnappy } from "@/lib/motion"
import {
  DropdownMenu as DropdownMenuPrimitive,
  DropdownMenuCheckboxItem as DropdownMenuCheckboxItemPrimitive,
  DropdownMenuContent as DropdownMenuContentPrimitive,
  DropdownMenuGroup as DropdownMenuGroupPrimitive,
  DropdownMenuItem as DropdownMenuItemPrimitive,
  DropdownMenuItemIndicator,
  DropdownMenuLabel as DropdownMenuLabelPrimitive,
  DropdownMenuPortal as DropdownMenuPortalPrimitive,
  DropdownMenuRadioGroup as DropdownMenuRadioGroupPrimitive,
  DropdownMenuRadioItem as DropdownMenuRadioItemPrimitive,
  DropdownMenuSeparator as DropdownMenuSeparatorPrimitive,
  DropdownMenuShortcut as DropdownMenuShortcutPrimitive,
  DropdownMenuSub as DropdownMenuSubPrimitive,
  DropdownMenuSubContent as DropdownMenuSubContentPrimitive,
  DropdownMenuSubTrigger as DropdownMenuSubTriggerPrimitive,
  DropdownMenuTrigger as DropdownMenuTriggerPrimitive,
} from "@/components/animate-ui/primitives/radix/dropdown-menu"

/**
 * DropdownMenu — a list of *actions or destinations*. A list of *choices* is a
 * Select; light information is a Popover.
 *
 * The engine is Animate UI + `motion`, which is what gives the menu a real exit
 * animation — the CSS `animate-out` classes that used to live here never ran,
 * because Radix unmounts the content before the keyframe can play. The stock
 * CSS classes are gone; one component, one engine.
 *
 * `highlighted` is one style for both hover and arrow-key navigation, not two.
 * We keep it as a plain `data-[highlighted]` background rather than the
 * primitive's sliding highlight: the sliding block needs every item wrapped in
 * a `HighlightItem`, which every future caller would have to remember, and the
 * four bugs this design system is unpicking all came from things callers had to
 * remember.
 */
function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive>) {
  return <DropdownMenuPrimitive data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger(
  props: React.ComponentProps<typeof DropdownMenuTriggerPrimitive>
) {
  return <DropdownMenuTriggerPrimitive data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuPortal(
  props: React.ComponentProps<typeof DropdownMenuPortalPrimitive>
) {
  return <DropdownMenuPortalPrimitive {...props} />
}

function DropdownMenuGroup(
  props: React.ComponentProps<typeof DropdownMenuGroupPrimitive>
) {
  return <DropdownMenuGroupPrimitive data-slot="dropdown-menu-group" {...props} />
}

/** Same surface as the Select menu: popover, border, elevation 1. */
const menuSurface = [
  "z-50 overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground",
  "shadow-md dark:shadow-none",
]

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuContentPrimitive>) {
  return (
    <DropdownMenuContentPrimitive
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      transition={springSnappy}
      className={cn(menuSurface, "w-68 max-h-80 overflow-y-auto", className)}
      initial={{ opacity: 0, scale: 0.98, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      {...props}
    />
  )
}

/**
 * 40 px tall, 8 px side padding, 12 px between icon and label — the same row
 * height as a list item and a nav item, so the three never look like three
 * different products.
 */
const menuItem = [
  "relative flex h-10 cursor-pointer items-center gap-3 rounded-md px-2",
  "text-sm leading-5 text-foreground outline-none select-none",
  "transition-control",
  "data-[highlighted]:bg-accent",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  "[&>svg]:text-muted-text",
]

function DropdownMenuItem({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuItemPrimitive> & {
  tone?: "default" | "destructive"
}) {
  return (
    <DropdownMenuItemPrimitive
      data-slot="dropdown-menu-item"
      data-tone={tone}
      className={cn(
        menuItem,
        // Highlighted destructive keeps a red wash instead of the neutral
        // accent, so the danger is still readable with the cursor on it.
        tone === "destructive" &&
          "text-destructive-text data-[highlighted]:bg-destructive/10 [&>svg]:text-destructive-text",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuCheckboxItemPrimitive>) {
  return (
    <DropdownMenuCheckboxItemPrimitive
      data-slot="dropdown-menu-checkbox-item"
      className={cn(menuItem, "justify-between", className)}
      {...props}
    >
      {children}
      <DropdownMenuItemIndicator className="ml-auto flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </DropdownMenuItemIndicator>
    </DropdownMenuCheckboxItemPrimitive>
  )
}

function DropdownMenuRadioGroup(
  props: React.ComponentProps<typeof DropdownMenuRadioGroupPrimitive>
) {
  return <DropdownMenuRadioGroupPrimitive data-slot="dropdown-menu-radio-group" {...props} />
}

/** Checked items use the Select `selected` look: a tick on the right. */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuRadioItemPrimitive>) {
  return (
    <DropdownMenuRadioItemPrimitive
      data-slot="dropdown-menu-radio-item"
      className={cn(menuItem, "justify-between", className)}
      {...props}
    >
      {children}
      <DropdownMenuItemIndicator className="ml-auto flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </DropdownMenuItemIndicator>
    </DropdownMenuRadioItemPrimitive>
  )
}

/**
 * Section eyebrow. Figma draws it at 11 px; 12 is the floor for readable text
 * in this system (Body/Xs), so it lands on 12.
 */
function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuLabelPrimitive>) {
  return (
    <DropdownMenuLabelPrimitive
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 font-mono text-xs leading-4 tracking-wide text-muted-text uppercase",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparatorPrimitive>) {
  return (
    <DropdownMenuSeparatorPrimitive
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuShortcutPrimitive>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto text-sm leading-5 text-muted-text", className)}
      {...props}
    />
  )
}

function DropdownMenuSub(props: React.ComponentProps<typeof DropdownMenuSubPrimitive>) {
  return <DropdownMenuSubPrimitive data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubTriggerPrimitive>) {
  return (
    <DropdownMenuSubTriggerPrimitive
      data-slot="dropdown-menu-sub-trigger"
      className={cn(menuItem, "justify-between data-[state=open]:bg-accent", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4 text-muted-text" />
    </DropdownMenuSubTriggerPrimitive>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubContentPrimitive>) {
  return (
    <DropdownMenuSubContentPrimitive
      data-slot="dropdown-menu-sub-content"
      transition={springSnappy}
      className={cn(menuSurface, "w-50", className)}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
