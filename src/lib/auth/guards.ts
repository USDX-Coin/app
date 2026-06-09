// Pure guard predicates over the consumer user (USDX-150). The dashboard layout
// enforces `requireAuth` (redirect to /login). These derive the email-verified and
// KYC-verified gates that lock down KYC submission and Week 2+ transactions.

import type { User } from "@/types";

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
