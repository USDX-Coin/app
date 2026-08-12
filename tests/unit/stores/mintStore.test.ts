import { describe, test, expect, beforeEach } from "vitest";
import { useMintStore } from "@/stores/mintStore";

describe("mintStore", () => {
  beforeEach(() => {
    useMintStore.getState().reset();
  });

  describe("positive", () => {
    test("setAmount changes amount", () => {
      useMintStore.getState().setAmount("1000");
      expect(useMintStore.getState().amount).toBe("1000");
    });

    test("setAmountCurrency changes currency", () => {
      useMintStore.getState().setAmountCurrency("IDR");
      expect(useMintStore.getState().amountCurrency).toBe("IDR");
    });

    test("setDestinationAddress changes address", () => {
      useMintStore.getState().setDestinationAddress("0xabc");
      expect(useMintStore.getState().destinationAddress).toBe("0xabc");
    });

    test("reset restores initial state", () => {
      useMintStore.getState().setAmount("500");
      useMintStore.getState().setAmountCurrency("IDR");
      useMintStore.getState().setDestinationAddress("0xabc");
      useMintStore.getState().reset();

      const state = useMintStore.getState();
      expect(state.amount).toBe("");
      expect(state.amountCurrency).toBe("USD");
      expect(state.destinationAddress).toBe("");
      expect(state.chainId).toBe("polygon");
    });
  });

  describe("negative", () => {
    test("initial state has empty form data", () => {
      const state = useMintStore.getState();
      expect(state.amount).toBe("");
      expect(state.destinationAddress).toBe("");
    });
  });

  describe("edge cases", () => {
    test("default currency is USD", () => {
      expect(useMintStore.getState().amountCurrency).toBe("USD");
    });

    test("chain is locked to Polygon (Phase 2 Polygon-only)", () => {
      expect(useMintStore.getState().chainId).toBe("polygon");
    });
  });
});
