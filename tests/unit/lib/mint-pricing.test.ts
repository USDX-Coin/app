import { describe, test, expect } from "vitest";
import { cheapestBuyRate, offeredBuyRates, subtotalForMinimum } from "@/lib/mint/pricing";
import type { ConsumerRate, PaymentMethodSummary } from "@/types";

// D25 rev-15 (`bni-integration.md` §4.3.3/§4.3.4): the form converts with the
// cheapest buy rate among the OFFERED methods (`paymentMethods[]`, back office).

function rate(overrides: Partial<ConsumerRate> = {}): ConsumerRate {
  return {
    baseRate: "16000.00",
    spreadBuyPct: "2.5",
    spreadSellPct: "2.0",
    effectiveBuyRate: "16400.00",
    bniTransferBuyRate: "15950.00",
    bniTransferBuyRateUpdatedAt: "2026-10-02T02:15:00Z",
    gatewayBuyRate: "16160.00",
    effectiveSellRate: "15680.00",
    updatedAt: "2026-10-02T02:15:00Z",
    ...overrides,
  };
}

const BNI: PaymentMethodSummary = {
  channel: "BANK_TRANSFER",
  bank: "BNI",
  provider: "BNI",
  feeType: "FLAT_IDR",
  feeValue: "0.00",
};
const VA: PaymentMethodSummary = {
  channel: "VA",
  bank: "NOBU",
  provider: "DURIANPAY_SNAP",
  feeType: "FLAT_IDR",
  feeValue: "4000.00",
};
const QRIS: PaymentMethodSummary = {
  channel: "QRIS",
  bank: null,
  provider: "MOCK",
  feeType: "PERCENT",
  feeValue: "0.7",
};

describe("offeredBuyRates", () => {
  describe("positive", () => {
    test("both methods offered → both rates", () => {
      expect(offeredBuyRates(rate(), [VA, BNI])).toEqual({ bniTransfer: 15950, gateway: 16160 });
    });
  });

  describe("negative", () => {
    test("BNI not in the method list → its rate is dropped even if the endpoint sends one", () => {
      expect(offeredBuyRates(rate(), [VA])).toEqual({ bniTransfer: null, gateway: 16160 });
    });

    test("BNI offered but its rate is null → BNI does not count", () => {
      expect(offeredBuyRates(rate({ bniTransferBuyRate: null }), [VA, BNI])).toEqual({
        bniTransfer: null,
        gateway: 16160,
      });
    });

    test("no VA in the list → the VA rate is dropped", () => {
      expect(offeredBuyRates(rate(), [BNI])).toEqual({ bniTransfer: 15950, gateway: null });
    });

    test("rate or method list unknown → null, nothing guessed", () => {
      expect(offeredBuyRates(undefined, [VA])).toBeNull();
      expect(offeredBuyRates(rate(), null)).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("a pre-D25 rate (no gatewayBuyRate) gives no VA rate — never the deprecated one", () => {
      const legacy = rate({ bniTransferBuyRate: undefined, gatewayBuyRate: undefined });
      expect(offeredBuyRates(legacy, [VA])).toEqual({ bniTransfer: null, gateway: null });
    });

    test("zero, negative or garbage rates are unusable", () => {
      expect(offeredBuyRates(rate({ gatewayBuyRate: "0" }), [VA])?.gateway).toBeNull();
      expect(offeredBuyRates(rate({ gatewayBuyRate: "-1" }), [VA])?.gateway).toBeNull();
      expect(offeredBuyRates(rate({ gatewayBuyRate: "abc" }), [VA])?.gateway).toBeNull();
    });

    test("QRIS has no D25 rate and adds nothing", () => {
      expect(offeredBuyRates(rate(), [QRIS])).toEqual({ bniTransfer: null, gateway: null });
    });
  });
});

describe("cheapestBuyRate", () => {
  describe("positive", () => {
    test("BNI cheaper → BNI", () => {
      expect(cheapestBuyRate({ bniTransfer: 15950, gateway: 16160 })).toBe(15950);
    });

    test("VA cheaper → VA (no method is assumed cheaper)", () => {
      expect(cheapestBuyRate({ bniTransfer: 16300, gateway: 16160 })).toBe(16160);
    });
  });

  describe("negative", () => {
    test("nothing offered → null", () => {
      expect(cheapestBuyRate({ bniTransfer: null, gateway: null })).toBeNull();
      expect(cheapestBuyRate(null)).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("only one method offered → its rate", () => {
      expect(cheapestBuyRate({ bniTransfer: null, gateway: 16160 })).toBe(16160);
      expect(cheapestBuyRate({ bniTransfer: 15950, gateway: null })).toBe(15950);
    });
  });
});

describe("subtotalForMinimum", () => {
  describe("positive", () => {
    test("judged at the HIGHEST offered rate — create rejects only if no method passes", () => {
      expect(subtotalForMinimum(2, { bniTransfer: 15950, gateway: 16160 })).toBe(32320);
    });
  });

  describe("negative", () => {
    test("no amount or no method → null", () => {
      expect(subtotalForMinimum(0, { bniTransfer: 15950, gateway: 16160 })).toBeNull();
      expect(subtotalForMinimum(2, { bniTransfer: null, gateway: null })).toBeNull();
      expect(subtotalForMinimum(2, null)).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("settled to 2 decimals like the backend subtotal", () => {
      expect(subtotalForMinimum(0.123457, { bniTransfer: null, gateway: 16160 })).toBe(1995.07);
    });
  });
});
