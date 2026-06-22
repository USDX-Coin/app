import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useRedeem } from "@/hooks/useRedeem";
import { useRedeemStore } from "@/stores/redeemStore";

// The wallet is real (RainbowKit/wagmi) in the app, but there's no provider in
// jsdom — stub the contextual-connect hook. Form validity doesn't depend on it.
vi.mock("@/lib/redeem/wallet", () => ({
  useRedeemWallet: () => ({ isConnected: false, address: undefined, connect: () => {} }),
}));

// Mock sell rate (mock-api): base 16000 × (1 − 2%) = 15680.
const SELL_RATE = 15680;

function fillValidForm() {
  const s = useRedeemStore.getState();
  s.setAmount("100");
  s.setBankCode("014");
  s.setBankAccountNumber("1234563210");
  s.setBankAccountName("SINGGIH BRILIAN TARA");
}

beforeEach(() => {
  useRedeemStore.getState().reset();
});

describe("useRedeem", () => {
  describe("validation", () => {
    describe("positive", () => {
      test("no errors when the form is valid", async () => {
        fillValidForm();
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
        expect(result.current.amountError).toBeNull();
        expect(result.current.accountNumberError).toBeNull();
        expect(result.current.accountNameError).toBeNull();
        expect(result.current.belowMinPayout).toBe(false);
        expect(result.current.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("amountError for amounts below the minimum", () => {
        useRedeemStore.getState().setAmount("5");
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        expect(result.current.amountError).toContain("Minimum");
      });

      test("isFormValid false without bank details", async () => {
        useRedeemStore.getState().setAmount("100");
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
        expect(result.current.isFormValid).toBe(false);
      });

      test("invalid account number is rejected", () => {
        useRedeemStore.getState().setBankAccountNumber("12");
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        expect(result.current.accountNumberError).not.toBeNull();
      });
    });

    describe("edge cases", () => {
      test("lazy validation — no errors when empty", () => {
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        expect(result.current.amountError).toBeNull();
        expect(result.current.accountNumberError).toBeNull();
        expect(result.current.accountNameError).toBeNull();
      });
    });
  });

  describe("fee breakdown", () => {
    describe("positive", () => {
      // week3.md § Fee & Spread worked example: 100 USDX → gross 1,568,000 −
      // redeem fee 15,680 − disbursement fee 5,000 = net 1,547,320.
      test("net payout = gross − redeem fee − disbursement fee", async () => {
        useRedeemStore.getState().setAmount("100");
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
        expect(result.current.amountUsdx).toBeCloseTo(100, 6);
        expect(result.current.grossIdr).toBeCloseTo(1_568_000, 0);
        expect(result.current.redeemFeeIdr).toBeCloseTo(15_680, 0);
        expect(result.current.disbursementFeeIdr).toBe(5_000);
        expect(result.current.totalFeeIdr).toBeCloseTo(20_680, 0);
        expect(result.current.netPayoutIdr).toBe(1_547_320);
      });

      test("IDR denomination treats the amount as gross", async () => {
        const s = useRedeemStore.getState();
        s.setAmount("1568000");
        s.setAmountCurrency("IDR");
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
        expect(result.current.grossIdr).toBeCloseTo(1_568_000, 0);
        expect(result.current.amountUsdx).toBeCloseTo(100, 4);
        expect(result.current.netPayoutIdr).toBe(1_547_320);
      });
    });

    describe("edge cases", () => {
      test("zero amount yields a zero breakdown", () => {
        useRedeemStore.getState().setAmount("0");
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        expect(result.current.amountUsdx).toBe(0);
        expect(result.current.netPayoutIdr).toBe(0);
        expect(result.current.isFormValid).toBe(false);
      });
    });
  });

  describe("denomination toggle", () => {
    describe("positive", () => {
      test("toggleCurrency flips USD ↔ IDR", () => {
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        expect(result.current.amountCurrency).toBe("USD");
        act(() => result.current.toggleCurrency());
        expect(useRedeemStore.getState().amountCurrency).toBe("IDR");
      });
    });
  });

  describe("submit", () => {
    describe("positive", () => {
      test("submitRedeem creates the order and moves to the tracker", async () => {
        fillValidForm();
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isFormValid).toBe(true));

        await act(async () => {
          await result.current.submitRedeem();
        });

        expect(useRedeemStore.getState().step).toBe("tracker");
        expect(useRedeemStore.getState().orderId).toMatch(/^rdm_/);
      });
    });
  });
});
