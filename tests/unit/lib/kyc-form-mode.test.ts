import { describe, test, expect } from "vitest";
import { kycFormMode, type KycFormMode } from "@/lib/kyc/form-mode";
import type { KycMyStatus, KycStatus } from "@/types";

// USDX-545 — which /kyc form a customer is offered.
//
// The rule that matters most is a NEGATIVE one: a VERIFIED customer must never be
// offered the "full" form, because submitting it sets status back to PENDING. Every
// status x cddComplete x resubmitting combination is enumerated below so that rule
// cannot be broken by an edit that "only" touches one branch.

const ALL_STATUSES: KycStatus[] = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"];
const ALL_CDD: (boolean | undefined)[] = [true, false, undefined];

function st(status: KycStatus, cddComplete?: boolean): KycMyStatus {
  return { status, cddComplete };
}

describe("kycFormMode", () => {
  describe("positive", () => {
    test("VERIFIED with CDD missing gets the CDD-only top-up", () => {
      expect(kycFormMode(st("VERIFIED", false), false)).toBe<KycFormMode>("cdd-only");
    });

    test("UNVERIFIED and PENDING keep the full form (unchanged from USDX-152)", () => {
      expect(kycFormMode(st("UNVERIFIED"), false)).toBe<KycFormMode>("full");
      expect(kycFormMode(st("PENDING"), false)).toBe<KycFormMode>("full");
    });

    test("REJECTED shows the full form only after opting into a resubmit", () => {
      expect(kycFormMode(st("REJECTED"), false)).toBe<KycFormMode>("none");
      expect(kycFormMode(st("REJECTED"), true)).toBe<KycFormMode>("full");
    });

    test("VERIFIED with CDD on record gets no form at all", () => {
      expect(kycFormMode(st("VERIFIED", true), false)).toBe<KycFormMode>("none");
    });
  });

  describe("negative", () => {
    test("a VERIFIED customer is NEVER offered the full form, whatever the inputs", () => {
      for (const cddComplete of ALL_CDD) {
        for (const resubmitting of [true, false]) {
          expect(
            kycFormMode(st("VERIFIED", cddComplete), resubmitting),
            `VERIFIED cddComplete=${cddComplete} resubmitting=${resubmitting}`,
          ).not.toBe("full");
        }
      }
    });

    test("the CDD-only form is NEVER offered to a customer who is not VERIFIED", () => {
      for (const status of ALL_STATUSES.filter((s) => s !== "VERIFIED")) {
        for (const cddComplete of ALL_CDD) {
          for (const resubmitting of [true, false]) {
            expect(
              kycFormMode(st(status, cddComplete), resubmitting),
              `${status} cddComplete=${cddComplete} resubmitting=${resubmitting}`,
            ).not.toBe("cdd-only");
          }
        }
      }
    });

    test("cddComplete never affects a non-VERIFIED customer", () => {
      for (const status of ALL_STATUSES.filter((s) => s !== "VERIFIED")) {
        for (const resubmitting of [true, false]) {
          const modes = ALL_CDD.map((c) => kycFormMode(st(status, c), resubmitting));
          expect(new Set(modes).size, `${status} resubmitting=${resubmitting}`).toBe(1);
        }
      }
    });
  });

  describe("edge cases", () => {
    test("cddComplete undefined (backend has not shipped it) shows no form", () => {
      // Not "cdd-only": nagging a customer for an answer the API cannot accept yet
      // is worse than staying quiet. Flips on by itself once the backend sends false.
      expect(kycFormMode(st("VERIFIED", undefined), false)).toBe<KycFormMode>("none");
    });

    test("the full form is reachable only from UNVERIFIED, PENDING, or a REJECTED resubmit", () => {
      const full: string[] = [];
      for (const status of ALL_STATUSES) {
        for (const cddComplete of ALL_CDD) {
          for (const resubmitting of [true, false]) {
            if (kycFormMode(st(status, cddComplete), resubmitting) === "full") {
              full.push(`${status}/${resubmitting}`);
            }
          }
        }
      }
      expect([...new Set(full)].sort()).toEqual([
        "PENDING/false",
        "PENDING/true",
        "REJECTED/true",
        "UNVERIFIED/false",
        "UNVERIFIED/true",
      ]);
    });

    test("every combination resolves to one of the three known modes", () => {
      for (const status of ALL_STATUSES) {
        for (const cddComplete of ALL_CDD) {
          for (const resubmitting of [true, false]) {
            expect(["none", "full", "cdd-only"]).toContain(
              kycFormMode(st(status, cddComplete), resubmitting),
            );
          }
        }
      }
    });
  });
});
