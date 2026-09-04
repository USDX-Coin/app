import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * NativeSelect — a real `<select>`, styled to match `Input`.
 *
 * Kept native for the KYC form on purpose: it inherits the OS picker (much
 * better on a phone) and it is the only control that still obeys a wrapping
 * `<fieldset disabled>`, which is how the KYC PENDING lock works.
 */
const nativeSelectSizes = {
  lg: "h-11",
  md: "h-10",
} as const

function NativeSelect({
  className,
  size = "lg",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  size?: keyof typeof nativeSelectSizes
}) {
  return (
    <div
      className="group/native-select relative w-full has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          nativeSelectSizes[size],
          "w-full min-w-0 appearance-none rounded-lg border border-input bg-card px-3 pr-9 dark:bg-input/30",
          "text-base md:text-sm",
          "transition-control outline-none",
          "pointer-fine:hover:border-foreground/25",
          "focus-visible:border-focus-ring focus-visible:ring-2 focus-visible:ring-focus-ring",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-text",
          className
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-text select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
