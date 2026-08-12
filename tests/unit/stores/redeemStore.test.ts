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
      expect(state.savedAccount).toBeNull();
      expect(state.bankCode).toBe("");
      expect(state.bankAccountNumber).toBe("");
      expect(state.bankAccountName).toBe("");
      expect(state.orderId).toBeNull();
    });
  });

  describe("saved account (USDX-267)", () => {
    const SAVED = {
      id: "seed_bank_1",
      bankCode: "014",
      bankName: "BCA",
      accountNumber: "1234563210",
      accountName: "SINGGIH BRILIAN TARA",
    };

    test("selectSavedAccount stores the snapshot and clears manual fields", () => {
      const s = useRedeemStore.getState();
      s.setBankCode("008");
      s.setBankAccountNumber("7788990011");
      s.setBankAccountName("OLD NAME");
      s.selectSavedAccount(SAVED);

      const state = useRedeemStore.getState();
      expect(state.savedAccount).toEqual(SAVED);
      expect(state.bankCode).toBe("");
      expect(state.bankAccountNumber).toBe("");
      expect(state.bankAccountName).toBe("");
    });

    test("clearSavedAccount drops the saved reference (back to manual)", () => {
      const s = useRedeemStore.getState();
      s.selectSavedAccount(SAVED);
      s.clearSavedAccount();
      expect(useRedeemStore.getState().savedAccount).toBeNull();
    });

    test("reset clears the saved account", () => {
      const s = useRedeemStore.getState();
      s.selectSavedAccount(SAVED);
      s.reset();
      expect(useRedeemStore.getState().savedAccount).toBeNull();
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

  describe("burn guard (USDX-259)", () => {
    test("default burn state is idle with no error", () => {
      const state = useRedeemStore.getState();
      expect(state.burnState).toBe("idle");
      expect(state.burnErrorKey).toBeNull();
    });

    test("setBurnState + setBurnError update the guard", () => {
      const s = useRedeemStore.getState();
      s.setBurnState("submitting");
      expect(useRedeemStore.getState().burnState).toBe("submitting");
      s.setBurnState("error");
      s.setBurnError("redeem.burnRejected");
      expect(useRedeemStore.getState().burnState).toBe("error");
      expect(useRedeemStore.getState().burnErrorKey).toBe("redeem.burnRejected");
    });

    test("resumeOrder opens the tracker for an existing order and clears burn state", () => {
      const s = useRedeemStore.getState();
      s.setBurnState("error");
      s.setBurnError("redeem.burnFailed");
      s.resumeOrder("rdm_resume_1");

      const state = useRedeemStore.getState();
      expect(state.orderId).toBe("rdm_resume_1");
      expect(state.step).toBe("tracker");
      expect(state.burnState).toBe("idle");
      expect(state.burnErrorKey).toBeNull();
    });

    test("reset restores idle burn state", () => {
      const s = useRedeemStore.getState();
      s.setBurnState("submitted");
      s.setBurnError("redeem.burnFailed");
      s.reset();
      const state = useRedeemStore.getState();
      expect(state.burnState).toBe("idle");
      expect(state.burnErrorKey).toBeNull();
    });
  });
});
