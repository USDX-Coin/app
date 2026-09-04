import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge, type BadgeProps } from "@/components/ui/badge"

type BadgeTone = NonNullable<BadgeProps["tone"]>

/**
 * Status → tone, written once.
 *
 * Riwayat, KYC, Profil and checkout all render the same statuses; before this
 * map each of them picked its own colour, which is how a verified KYC ended up
 * pink on the profile page.
 *
 * Every status the API can actually send is listed. The `neutral` fallback is a
 * safety net, not a resting place: it is what made `AWAITING_BURN` — an order
 * still waiting for the user to sign a burn — look exactly like `EXPIRED`.
 * `statusTone` now says so out loud in development.
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  // Mint order (MintOrderStatus) + payment (MintPaymentStatus)
  REQUESTED: "warning",
  WAITING_FOR_PAYMENT: "warning",
  PENDING_PAYMENT: "warning", // brief spelling; the API sends WAITING_FOR_PAYMENT
  PAID: "info",
  PROCESSING: "info",
  WAITING_FOR_APPROVAL: "info",
  HELD: "warning", // payment held — needs someone to act, not a dead end
  COMPLETED: "success",
  FAILED: "danger",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  // Redeem order (RedeemStatus)
  AWAITING_BURN: "warning", // the user still has to sign the burn
  BURNED: "info",
  PROCESSING_PAYOUT: "info",
  PAYOUT_COMPLETE: "success",
  // Safe / approval (MintSafeStatus)
  NONE: "neutral",
  PENDING_APPROVAL: "info",
  APPROVED: "info",
  EXECUTED: "success",
  // KYC
  VERIFIED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  UNVERIFIED: "neutral",
}

function statusTone(status: string | null | undefined): BadgeTone {
  if (!status) return "neutral"
  const tone = STATUS_TONE[status]
  if (!tone && process.env.NODE_ENV !== "production") {
    // Falling through to grey is how a live status quietly starts looking
    // expired. Better to hear about it the first time it renders.
    console.warn(`[StatusBadge] status "${status}" has no tone — add it to STATUS_TONE.`)
  }
  return tone ?? "neutral"
}

/**
 * StatusBadge — a Badge that picks its own tone from an API status. The label
 * stays the caller's job: it is translated, the status is not.
 *
 * There is deliberately **no `@container` wrapper here**. An earlier version
 * wrapped the pill in `@container/status` so it could shrink its padding in a
 * narrow cell; `container-type: inline-size` applies size containment, and a
 * contained element is laid out as if it had no contents — so the wrapper
 * measured 0 px wide and clipped the badge to 12 px on /profile. `w-fit` does
 * not rescue it either: `fit-content` also resolves against contents that
 * containment has emptied. A pill that hugs its text can never be its own
 * inline-size container.
 *
 * `max-w-full truncate` is what keeps it inside a narrow column instead.
 */
function StatusBadge({
  status,
  className,
  children,
  ...props
}: Omit<BadgeProps, "tone"> & { status: string | null | undefined }) {
  return (
    <Badge
      tone={statusTone(status)}
      data-status={status ?? undefined}
      className={cn("max-w-full truncate", className)}
      {...props}
    >
      {children}
    </Badge>
  )
}

export { StatusBadge, statusTone, STATUS_TONE }
export type { BadgeTone }
