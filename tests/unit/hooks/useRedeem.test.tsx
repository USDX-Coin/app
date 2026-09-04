import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useRedeem } from "@/hooks/useRedeem";
import { useRedeemStore } from "@/stores/redeemStore";

// useRedeemBurn signs the burn via wagmi `useWriteContract`; there's no
// WagmiProvider in jsdom, so stub it (the mock env path doesn't even call it).
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn().mockResolvedValue("0xhash") }),
}));

// The wallet is real (RainbowKit/wagmi) in the app, but there's no provider in
// jsdom — stub the contextual-connect + precondition hooks. Form validity doesn't
// depend on them. `canBurn: true` lets the submit test reach create.
vi.mock("@/lib/redeem/wallet", () => ({
  useRedeemWallet: () => ({ isConnected: false, address: undefined, connect: () => {} }),
  useRedeemPreconditions: () => ({
    isConnected: true,
    address: "0x000000C528aE908fB929a0898B65e913623c9aFf",
    connect: () => {},
    chainOk: true,
    switchNetwork: () => {},
    isSwitchingNetwork: false,
    balanceUsdx: 1_000_000,
    insufficientBalance: false,
    lowGasWarning: false,
    canBurn: true,
  }),
}));

// useRedeemBurn reads wagmi's useWriteContract for the real on-chain burn
// (USDX-263). There's no WagmiProvider in jsdom — stub it; the burn is never
// broadcast in these form-logic tests (the mock layer simulates it via useMock).
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
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
        expect(result.current.amountError).toBe("validation.amount.minRedeem");
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

  // Saved Bank Account Book path (USDX-267): pick an entry → only bankAccountId is
  // needed; no manual number re-entry. Uses seeded mock account seed_bank_1 (BCA).
  describe("saved-account path (USDX-267)", () => {
    const SAVED_ACCOUNT = {
      id: "seed_bank_1",
      bankCode: "014",
      bankName: "BCA",
      accountNumber: "1234563210",
      accountName: "SINGGIH BRILIAN TARA",
    };

    describe("positive", () => {
      test("valid without manual fields once an account is picked", async () => {
        const s = useRedeemStore.getState();
        s.setAmount("100");
        s.selectSavedAccount(SAVED_ACCOUNT);
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
        expect(result.current.bankAccountNumber).toBe(""); // no plaintext re-entry
        expect(result.current.isFormValid).toBe(true);
      });

      test("destination mirrors the saved entry (full number + name)", () => {
        useRedeemStore.getState().selectSavedAccount(SAVED_ACCOUNT);
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
        expect(result.current.destination).toEqual({
          bankCode: "014",
          bankName: "BCA",
          accountNumber: "1234563210",
          accountName: "SINGGIH BRILIAN TARA",
        });
      });

      test("submitRedeem creates the order via bankAccountId", async () => {
        const s = useRedeemStore.getState();
        s.setAmount("100");
        s.selectSavedAccount(SAVED_ACCOUNT);
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
