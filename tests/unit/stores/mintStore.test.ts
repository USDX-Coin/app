import { describe, test, expect, beforeEach } from "vitest";
import { useMintStore } from "@/stores/mintStore";

describe("mintStore", () => {
  beforeEach(() => {
    useMintStore.getState().reset();
  });

  describe("positive", () => {
    test("setStep changes step", () => {
      useMintStore.getState().setStep("confirmation");
      expect(useMintStore.getState().step).toBe("confirmation");
    });

    test("setChainId changes chain", () => {
      useMintStore.getState().setChainId("polygon");
      expect(useMintStore.getState().chainId).toBe("polygon");
    });

    test("setAmount changes amount", () => {
      useMintStore.getState().setAmount("1000");
      expect(useMintStore.getState().amount).toBe("1000");
    });

    test("setDestinationAddress changes address", () => {
      useMintStore.getState().setDestinationAddress("0xabc");
      expect(useMintStore.getState().destinationAddress).toBe("0xabc");
    });

    test("reset restores initial state", () => {
      useMintStore.getState().setStep("confirmation");
      useMintStore.getState().setAmount("500");
      useMintStore.getState().setChainId("polygon");
      useMintStore.getState().reset();

      const state = useMintStore.getState();
      expect(state.step).toBe("form");
      expect(state.amount).toBe("");
      expect(state.chainId).toBe("base");
      expect(state.destinationAddress).toBe("");
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
    test("initial step is form", () => {
      expect(useMintStore.getState().step).toBe("form");
    });

    test("default chain is base", () => {
      expect(useMintStore.getState().chainId).toBe("base");
    });

    test("can transition through all steps", () => {
      const store = useMintStore.getState();
      store.setStep("form");
      expect(useMintStore.getState().step).toBe("form");
      store.setStep("confirmation");
      expect(useMintStore.getState().step).toBe("confirmation");
      store.setStep("status");
      expect(useMintStore.getState().step).toBe("status");
    });
  });
});
