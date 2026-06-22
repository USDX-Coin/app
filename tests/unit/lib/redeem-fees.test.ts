import { describe, test, expect } from "vitest";
import { computeRedeemBreakdown } from "@/lib/redeem/fees";

const RATE = 15680; // base 16000 × (1 − 2% sell spread)
const base = (over: Partial<Parameters<typeof computeRedeemBreakdown>[0]> = {}) => ({
  amount: 100,
  amountCurrency: "USD" as const,
  effectiveSellRate: RATE,
  redeemFeePct: 1,
  disbursementFeeFlatIdr: 5000,
  ...over,
});

describe("computeRedeemBreakdown", () => {
  describe("positive", () => {
    // week3.md § Fee & Spread worked example.
    test("USD denomination: net = gross − redeem fee − disbursement fee", () => {
      const b = computeRedeemBreakdown(base());
      expect(b.amountUsdx).toBeCloseTo(100, 6);
      expect(b.grossIdr).toBeCloseTo(1_568_000, 0);
      expect(b.redeemFeeIdr).toBeCloseTo(15_680, 0);
      expect(b.disbursementFeeIdr).toBe(5_000);
      expect(b.totalFeeIdr).toBeCloseTo(20_680, 0);
      expect(b.netPayoutIdr).toBe(1_547_320);
    });

    test("IDR denomination: the amount is the gross sale value", () => {
      const b = computeRedeemBreakdown(base({ amount: 1_568_000, amountCurrency: "IDR" }));
      expect(b.grossIdr).toBe(1_568_000);
      expect(b.amountUsdx).toBeCloseTo(100, 4);
      expect(b.netPayoutIdr).toBe(1_547_320);
    });
  });

  describe("edge cases", () => {
    test("non-positive amount or rate returns a zero breakdown", () => {
      expect(computeRedeemBreakdown(base({ amount: 0 })).netPayoutIdr).toBe(0);
      expect(computeRedeemBreakdown(base({ effectiveSellRate: 0 })).grossIdr).toBe(0);
    });

    test("net is floored and never negative when fees exceed gross", () => {
      const b = computeRedeemBreakdown(base({ amount: 1000, amountCurrency: "IDR" }));
      expect(b.netPayoutIdr).toBe(0);
    });

    test("net is an integer (floored to whole rupiah)", () => {
      const b = computeRedeemBreakdown(base({ amount: 10 }));
      expect(Number.isInteger(b.netPayoutIdr)).toBe(true);
      expect(b.netPayoutIdr).toBe(150_232);
    });
  });
});
