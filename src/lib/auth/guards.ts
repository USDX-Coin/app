// Pure guard predicates over the consumer user (USDX-150). The dashboard layout
// enforces `requireAuth` (redirect to /login). These derive the email-verified and
// KYC-verified gates that lock down KYC submission and Week 2+ transactions.

import type { User } from "@/types";

// Three states, because there are three. The user object is not persisted, so on
// every cold load it is `null` until GET /api/v2/auth/me answers:
//
//   "unknown"  — the session has not answered yet. WAIT. Render a skeleton. Never
//                redirect, never lock, never render a verdict about the customer.
//   "allowed"  — the server said yes.
//   "blocked"  — the server said no.
//
// Folding "unknown" into "blocked" is the one failure this file exists to prevent:
// it would throw a legitimate, verified customer at the verification gate on every
// single reload — far worse than the data-at-rest leak that removing persistence
// fixes.
export type GateState = "unknown" | "allowed" | "blocked";

export function emailVerificationGate(user: User | null | undefined): GateState {
  if (!user) return "unknown";
  return user.emailVerifiedAt ? "allowed" : "blocked";
}

// Two-state reads, for display only (a badge, a label). They cannot tell "not
// verified" from "not loaded yet", so nothing that redirects, hides a page or
// locks an action may call them — use `emailVerificationGate` there instead.
export function isEmailVerified(user: User | null | undefined): boolean {
  return !!user?.emailVerifiedAt;
}

export function isKycVerified(user: User | null | undefined): boolean {
  return user?.kycStatus === "VERIFIED";
}

// Week 2+ transaction gate (mint / redeem / bridge). All three must hold.
export function canTransact(user: User | null | undefined): boolean {
  return isEmailVerified(user) && isKycVerified(user) && !user?.suspended;
}
