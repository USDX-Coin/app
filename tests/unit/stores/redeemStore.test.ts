import { describe, test, expect, beforeEach } from "vitest";
import { useRedeemStore } from "@/stores/redeemStore";

describe("redeemStore", () => {
  beforeEach(() => {
    useRedeemStore.getState().reset();
  });

  describe("positive", () => {
    test("setStep changes step", () => {
      useRedeemStore.getState().setStep("tracker");
      expect(useRedeemStore.getState().step).toBe("tracker");
    });

    test("setters update amount + bank fields", () => {
      const s = useRedeemStore.getState();
      s.setAmount("100");
      s.setAmountCurrency("IDR");
      s.setBankCode("014");
      s.setBankAccountNumber("1234563210");
      s.setBankAccountName("SINGGIH BRILIAN TARA");
      s.setOrderId("rdm_1");

      const state = useRedeemStore.getState();
      expect(state.amount).toBe("100");
      expect(state.amountCurrency).toBe("IDR");
      expect(state.bankCode).toBe("014");
      expect(state.bankAccountNumber).toBe("1234563210");
      expect(state.bankAccountName).toBe("SINGGIH BRILIAN TARA");
      expect(state.orderId).toBe("rdm_1");
    });

    test("reset restores initial state", () => {
      const s = useRedeemStore.getState();
      s.setStep("tracker");
      s.setAmount("1000");
      s.setBankCode("014");
      s.setOrderId("rdm_1");
      s.reset();

      const state = useRedeemStore.getState();
      expect(state.step).toBe("form");
      expect(state.amount).toBe("");
      expect(state.bankCode).toBe("");
      expect(state.orderId).toBeNull();
    });
  });

  describe("negative", () => {
    test("initial state has empty form data", () => {
      const state = useRedeemStore.getState();
      expect(state.amount).toBe("");
      expect(state.bankCode).toBe("");
      expect(state.bankAccountNumber).toBe("");
      expect(state.bankAccountName).toBe("");
      expect(state.orderId).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("default denomination is USD", () => {
      expect(useRedeemStore.getState().amountCurrency).toBe("USD");
    });

    test("can transition form → tracker", () => {
      const s = useRedeemStore.getState();
      s.setStep("form");
      expect(useRedeemStore.getState().step).toBe("form");
      s.setStep("tracker");
      expect(useRedeemStore.getState().step).toBe("tracker");
    });
  });
});
