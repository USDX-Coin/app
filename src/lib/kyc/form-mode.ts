import type { KycMyStatus } from "@/types";

// Which of the /kyc form modes a customer is offered (USDX-545).
//
// Extracted as a pure function precisely because ONE of its rules is dangerous to
// get wrong: a VERIFIED customer must never be handed the full KYC form. That form
// POSTs to the submit endpoint, which sets `status = PENDING` — so a mistake here
// would knock an already-verified customer back into review. Every combination is
// enumerated in tests/unit/lib/kyc-form-mode.test.ts.

export type KycFormMode =
  /** No form. Banner only. */
  | "none"
  /** The full identity + documents + CDD form (submit → PENDING). */
  | "full"
  /** CDD fields only — identity already accepted, nothing re-asked, status untouched. */
  | "cdd-only";

/**
 * @param status  from GET /api/v2/kyc/me
 * @param resubmitting  the REJECTED customer has pressed "Submit Ulang"
 */
export function kycFormMode(status: KycMyStatus, resubmitting: boolean): KycFormMode {
  if (status.status === "VERIFIED") {
    // Wisnu, 27 Aug 2026: a VERIFIED customer whose CDD is missing is NOTIFIED and
    // allowed to complete it — not gated at transaction time, and not left alone.
    // They are topping up a file, not re-applying, so: CDD only, and never "full".
    //
    // Strict `=== false`: `cddComplete` is absent until the backend ships it
    // (USDX-545 backend slice). Absent means "we do not know", and nagging a
    // customer we cannot yet accept an answer from is worse than staying quiet, so
    // unknown → no form. It lights up on its own once the backend reports `false`.
    return status.cddComplete === false ? "cdd-only" : "none";
  }

  // Unchanged from USDX-152.
  if (status.status === "UNVERIFIED" || status.status === "PENDING") return "full";
  // REJECTED: banner only, until the customer opts into the resubmit cycle.
  return resubmitting ? "full" : "none";
}
