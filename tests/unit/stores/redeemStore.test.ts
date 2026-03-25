import { describe, test, expect, beforeEach } from "vitest";
import { useRedeemStore } from "@/stores/redeemStore";

describe("redeemStore", () => {
  beforeEach(() => {
    useRedeemStore.getState().reset();
  });

  describe("positive", () => {
    test("setStep changes step", () => {
      useRedeemStore.getState().setStep("review");
      expect(useRedeemStore.getState().step).toBe("review");
    });

    test("setBankAccountId changes bank account", () => {
      useRedeemStore.getState().setBankAccountId("bank_1");
      expect(useRedeemStore.getState().bankAccountId).toBe("bank_1");
    });

    test("reset restores initial state", () => {
      useRedeemStore.getState().setStep("success");
      useRedeemStore.getState().setAmount("1000");
      useRedeemStore.getState().setBankAccountId("bank_1");
      useRedeemStore.getState().reset();

      const state = useRedeemStore.getState();
      expect(state.step).toBe("form");
      expect(state.amount).toBe("");
      expect(state.bankAccountId).toBe("");
    });
  });

  describe("negative", () => {
    test("initial state has empty form data", () => {
      const state = useRedeemStore.getState();
      expect(state.amount).toBe("");
      expect(state.bankAccountId).toBe("");
    });
  });

  describe("edge cases", () => {
    test("can transition through all redeem steps", () => {
      const store = useRedeemStore.getState();
      store.setStep("form");
      expect(useRedeemStore.getState().step).toBe("form");
      store.setStep("review");
      expect(useRedeemStore.getState().step).toBe("review");
      store.setStep("executing");
      expect(useRedeemStore.getState().step).toBe("executing");
      store.setStep("success");
      expect(useRedeemStore.getState().step).toBe("success");
    });

    test("default chain is base", () => {
      expect(useRedeemStore.getState().chainId).toBe("base");
    });
  });
});
