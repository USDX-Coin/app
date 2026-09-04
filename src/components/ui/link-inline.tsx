import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * LinkInline — a link that lives *inside* a sentence.
 *
 * "Belum punya akun? **Buat akun**", "Saya menyetujui **Ketentuan Layanan**".
 * Zero padding, size inherited from the surrounding text, so the line it sits
 * in keeps its rhythm. `Button variant="link"` is the other kind of link: it
 * stands on its own and carries a button's padding.
 *
 * Deliberately exempt from the 44 px touch-target rule — WCAG 2.5.8 excludes
 * links inside a block of text, and padding one out to 44 px would push the
 * lines around it apart.
 */
function LinkInline({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="link-inline"
      className={cn(
        "rounded-sm p-0 text-primary-text underline underline-offset-4 transition-control outline-none",
        "focus-visible:ring-2 focus-visible:ring-focus-ring",
        className
      )}
      {...props}
    />
  )
}

export { LinkInline }
