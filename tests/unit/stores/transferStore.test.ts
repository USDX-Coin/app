import { describe, test, expect, beforeEach } from "vitest";
import { useTransferStore } from "@/stores/transferStore";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("transferStore", () => {
  beforeEach(() => {
    useTransferStore.getState().reset();
  });

  describe("positive", () => {
    test("ensureIdempotencyKey creates a v7 key once and reuses it", () => {
      const s = useTransferStore.getState();
      const first = s.ensureIdempotencyKey();
      expect(first).toMatch(UUID);
      expect(s.ensureIdempotencyKey()).toBe(first);
      expect(useTransferStore.getState().idempotencyKey).toBe(first);
    });

    test("setResult moves to done, closes modal + PIN dialog and ends the intent", () => {
      const s = useTransferStore.getState();
      s.setReviewOpen(true);
      s.setPinOpen(true);
      s.ensureIdempotencyKey();
      s.setResult({
        txHash: "0x" + "ab".repeat(32),
        from: "0xfrom",
        to: "0xto",
        amount: "25.00",
        amountWei: "25000000",
        chain: "polygon",
        submittedAt: "2026-08-28T04:20:11.000Z",
      });
      const state = useTransferStore.getState();
      expect(state.step).toBe("done");
      expect(state.reviewOpen).toBe(false);
      expect(state.pinOpen).toBe(false);
      expect(state.idempotencyKey).toBeNull();
      expect(state.result?.txHash).toMatch(/^0xabab/);
    });
  });

  describe("negative", () => {
    test("changing the destination or the amount is a NEW intent → key dropped", () => {
      const s = useTransferStore.getState();
      s.setTo("0xA");
      s.setAmount("10");
      const key = s.ensureIdempotencyKey();
      s.setAmount("11");
      expect(useTransferStore.getState().idempotencyKey).toBeNull();
      const key2 = useTransferStore.getState().ensureIdempotencyKey();
      expect(key2).not.toBe(key);
      useTransferStore.getState().setTo("0xB");
      expect(useTransferStore.getState().idempotencyKey).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("re-setting the SAME value keeps the key (a retry is not a new intent)", () => {
      const s = useTransferStore.getState();
      s.setTo("0xA");
      s.setAmount("10");
      const key = s.ensureIdempotencyKey();
      useTransferStore.getState().setAmount("10");
      useTransferStore.getState().setTo("0xA");
      expect(useTransferStore.getState().idempotencyKey).toBe(key);
    });

    test("reset returns to the empty form", () => {
      const s = useTransferStore.getState();
      s.setTo("0xA");
      s.ensureIdempotencyKey();
      s.reset();
      expect(useTransferStore.getState()).toMatchObject({
        step: "form",
        to: "",
        amount: "",
        idempotencyKey: null,
        result: null,
      });
    });
  });
});
