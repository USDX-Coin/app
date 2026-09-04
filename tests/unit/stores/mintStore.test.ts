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

    test("setReviewOpen toggles the Ringkasan modal", () => {
      useMintStore.getState().setReviewOpen(true);
      expect(useMintStore.getState().reviewOpen).toBe(true);
      useMintStore.getState().setReviewOpen(false);
      expect(useMintStore.getState().reviewOpen).toBe(false);
    });

    test("beginHandoff latches handoffPending", () => {
      expect(useMintStore.getState().handoffPending).toBe(false);
      useMintStore.getState().beginHandoff();
      expect(useMintStore.getState().handoffPending).toBe(true);
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

    // The post-handoff cleanup is a single reset() — anything it fails to
    // clear is still on screen when the browser restores the page from bfcache.
    test("reset also closes the Ringkasan and clears the handoff latch", () => {
      useMintStore.getState().setAmount("10");
      useMintStore.getState().setDestinationAddress("0xabc");
      useMintStore.getState().setReviewOpen(true);
      useMintStore.getState().beginHandoff();

      useMintStore.getState().reset();

      const state = useMintStore.getState();
      expect(state.reviewOpen).toBe(false);
      expect(state.handoffPending).toBe(false);
      expect(state.amount).toBe("");
      expect(state.destinationAddress).toBe("");
    });
  });

  describe("negative", () => {
    test("initial state has empty form data", () => {
      const state = useMintStore.getState();
      expect(state.amount).toBe("");
      expect(state.destinationAddress).toBe("");
    });

    test("the store is not persisted — a fresh page load starts clean", () => {
      // The bfcache path needs an explicit reset (useMintHandoffReset); the
      // fresh-load path is covered only because nothing survives the reload. If
      // persist middleware is ever added here, a reload would replay a paid
      // order's form and this guard has to be revisited.
      useMintStore.getState().setAmount("500");
      useMintStore.getState().setDestinationAddress("0xabc");
      const dump = JSON.stringify(Object.values(localStorage));
      expect(dump).not.toContain("0xabc");
      expect(dump).not.toContain("500");
    });
  });

  describe("edge cases", () => {
    test("default currency is USD", () => {
      expect(useMintStore.getState().amountCurrency).toBe("USD");
    });

    test("the Ringkasan starts closed and no handoff is pending", () => {
      expect(useMintStore.getState().reviewOpen).toBe(false);
      expect(useMintStore.getState().handoffPending).toBe(false);
    });

    test("chain is locked to Polygon (Phase 2 Polygon-only)", () => {
      expect(useMintStore.getState().chainId).toBe("polygon");
    });
  });
});
