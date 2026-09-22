import { describe, test, expect } from "vitest";
import {
  isFinalTransferStatus,
  transferFailureReasonOf,
  transferStatusOf,
} from "@/lib/wallet-transfer";

// Tafsir status transfer custodial (wallet.yaml § WalletTransferStatus, USDX-701):
// enum boleh bertambah, dan klien wajib memperlakukan nilai tak dikenal seperti PENDING.
describe("wallet-transfer status", () => {
  describe("positive", () => {
    test("known statuses pass through unchanged", () => {
      expect(transferStatusOf({ status: "PENDING" })).toBe("PENDING");
      expect(transferStatusOf({ status: "CONFIRMED" })).toBe("CONFIRMED");
      expect(transferStatusOf({ status: "FAILED" })).toBe("FAILED");
    });

    test("FAILED carries its reason — REVERTED or DROPPED", () => {
      expect(transferFailureReasonOf({ status: "FAILED", failureReason: "REVERTED" })).toBe("REVERTED");
      expect(transferFailureReasonOf({ status: "FAILED", failureReason: "DROPPED" })).toBe("DROPPED");
    });

    test("only CONFIRMED and FAILED are final", () => {
      expect(isFinalTransferStatus("CONFIRMED")).toBe(true);
      expect(isFinalTransferStatus("FAILED")).toBe(true);
      expect(isFinalTransferStatus("PENDING")).toBe(false);
    });
  });

  describe("negative", () => {
    test("a reason on a non-FAILED transfer is ignored", () => {
      expect(transferFailureReasonOf({ status: "PENDING", failureReason: "REVERTED" })).toBeNull();
      expect(transferFailureReasonOf({ status: "CONFIRMED", failureReason: "DROPPED" })).toBeNull();
    });
  });

  describe("edge case", () => {
    test("an unknown status is read as PENDING (the contract's default branch)", () => {
      expect(transferStatusOf({ status: "SETTLING" })).toBe("PENDING");
      expect(transferStatusOf({ status: "" })).toBe("PENDING");
      expect(isFinalTransferStatus(transferStatusOf({ status: "SETTLING" }))).toBe(false);
    });

    test("an unknown status never yields a failure reason", () => {
      expect(transferFailureReasonOf({ status: "SETTLING", failureReason: "REVERTED" })).toBeNull();
    });

    test("FAILED with an unknown reason stays FAILED, just without a technical label", () => {
      const t = { status: "FAILED", failureReason: "REPLACED" };
      expect(transferStatusOf(t)).toBe("FAILED");
      expect(transferFailureReasonOf(t)).toBeNull();
    });
  });
});
