import * as React from "react"

import { cn } from "@/lib/utils"

/** Textarea — same surface as `Input`, height grows with the content. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 dark:bg-input/30",
        "text-base md:text-sm",
        "transition-control outline-none",
        "placeholder:text-muted-text",
        "pointer-fine:hover:border-foreground/25",
        "focus-visible:border-focus-ring focus-visible:ring-2 focus-visible:ring-focus-ring",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-text",
        "read-only:border-transparent read-only:bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
