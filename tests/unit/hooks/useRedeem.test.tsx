import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useRedeem } from "@/hooks/useRedeem";
import { useRedeemStore } from "@/stores/redeemStore";
import { useAppConfig } from "@/hooks/useAppConfig";
import { getAppConfig } from "@/lib/api/config-api";
import { getConsumerRate } from "@/lib/api/rate-api";
import type { AppConfig, ConsumerRate } from "@/types";

// USDX-682: the redeem minimum is backend-owned — a rupiah figure from
// `fee_configs.min_redeem_idr`, served by GET /api/v2/config. Mocked so a test can
// move it the way an admin would, and can take the field away entirely: that is the
// shape of the live response until this ticket's backend half merges.
vi.mock("@/lib/api/config-api", () => ({ getAppConfig: vi.fn() }));
const getAppConfigMock = vi.mocked(getAppConfig);

// The sell rate is mocked too so the ticket's own worked example — 2 USDX at a
// 16.250 rate — can be played at that exact rate instead of near it.
vi.mock("@/lib/api/rate-api", () => ({ getConsumerRate: vi.fn() }));
const getConsumerRateMock = vi.mocked(getConsumerRate);

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
// GET /api/v2/config default: the redeem minimum equals the mint one (PM, 13 Sep
// 2026), stated in rupiah and judged on the NET payout.
const MIN_REDEEM_IDR = 20_000;

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    minMintIdr: "20000.00",
    minRedeemIdr: "20000.00",
    mintFeePct: "1.0",
    pgFeeVaFlat: "4000.00",
    contractAddress: "0x1FF2000000000000000000000000000000000000",
    chain: "polygon",
    ...overrides,
  };
}

function rate(effectiveSellRate = SELL_RATE): ConsumerRate {
  return {
    baseRate: "16000.00",
    spreadBuyPct: "2.5",
    spreadSellPct: "2",
    effectiveBuyRate: "16400.00",
    effectiveSellRate: effectiveSellRate.toFixed(2),
    updatedAt: new Date().toISOString(),
  };
}

// Render once the two async inputs the minimum depends on have landed: the rate
// (there is no net payout without it) and the configured bound. Waiting matters —
// `belowMinPayout` is false before the config arrives, so an unawaited "passes"
// assertion would pass for the wrong reason.
async function renderWithMin(expectedRate = SELL_RATE) {
  const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.effectiveSellRate).toBe(expectedRate));
  await waitFor(() => expect(result.current.minRedeemIdr).not.toBeNull());
  return result;
}

// Same as above, for the cases where the config carries NO minimum (absent field,
// or a failed request). It renders `useAppConfig` alongside: both copies share one
// query key and one cache entry, so once this one has settled the one inside
// `useRedeem` has too — which is what makes "no minimum was asserted" a real
// assertion rather than a race with a request still in flight.
async function renderWithoutMin(opts: { expectError?: boolean } = {}) {
  const { result } = renderHook(() => ({ redeem: useRedeem(), cfg: useAppConfig() }), {
    wrapper: createWrapper(),
  });
  await waitFor(() => expect(result.current.redeem.effectiveSellRate).toBe(SELL_RATE));
  if (opts.expectError) {
    await waitFor(() => expect(result.current.cfg.isError).toBe(true), { timeout: 5000 });
  } else {
    await waitFor(() => expect(result.current.cfg.isLoading).toBe(false));
  }
  return result;
}

function fillValidForm() {
  const s = useRedeemStore.getState();
  s.setAmount("100");
  s.setBankCode("014");
  s.setBankAccountNumber("1234563210");
  s.setBankAccountName("SINGGIH BRILIAN TARA");
}

beforeEach(() => {
  useRedeemStore.getState().reset();
  getAppConfigMock.mockReset();
  getAppConfigMock.mockResolvedValue(config());
  getConsumerRateMock.mockReset();
  getConsumerRateMock.mockResolvedValue(rate());
});

describe("useRedeem", () => {
  describe("validation", () => {
    describe("positive", () => {
      test("no errors when the form is valid", async () => {
        fillValidForm();
        const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
        await waitFor(() => expect(result.current.minRedeemIdr).toBe(MIN_REDEEM_IDR));
        expect(result.current.amountError).toBeNull();
        expect(result.current.accountNumberError).toBeNull();
        expect(result.current.accountNameError).toBeNull();
        expect(result.current.belowMinPayout).toBe(false);
        expect(result.current.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("amountError no longer carries a minimum — that bound was in USDX", async () => {
        // USDX-682: `validateAmount(_, "redeem")` used to answer
        // `validation.amount.minRedeem` here, i.e. "Redeem minimal 10 USDX". The
        // minimum is rupiah now and lives in `belowMinPayout`.
        useRedeemStore.getState().setAmount("5");
        const result = await renderWithMin();
        expect(result.current.amountError).toBeNull();
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


  // The ONE minimum this screen has (USDX-682): a rupiah figure from
  // GET /api/v2/config (`minRedeemIdr`, sourced from `fee_configs.min_redeem_idr`),
  // judged on the NET payout — the money the customer actually receives. It
  // replaces `MIN_REDEEM_AMOUNT = 10`, a USDX bound worth Rp 162.500 at a 16.250
  // rate, 16x the rupiah floor the backend enforces, decided by nobody.
  describe("minimum payout (USDX-682)", () => {
    describe("positive", () => {
      test("2 USDX at a 16.250 sell rate passes — the ticket's own example", async () => {
        // Gross Rp 32.500 − 1% fee Rp 325 − disbursement Rp 5.000 = net Rp 27.175,
        // comfortably over the Rp 20.000 minimum. Until this ticket the screen
        // answered "Redeem minimal 10 USDX" and refused to go on.
        getConsumerRateMock.mockResolvedValue(rate(16_250));
        fillValidForm();
        useRedeemStore.getState().setAmount("2");

        const result = await renderWithMin(16_250);
        expect(result.current.grossIdr).toBe(32_500);
        expect(result.current.netPayoutIdr).toBe(27_175);
        expect(result.current.amountError).toBeNull();
        expect(result.current.belowMinPayout).toBe(false);
        expect(result.current.isFormValid).toBe(true);
      });

      test("a net payout exactly on the minimum is accepted", async () => {
        // Rp 25.253 gross → net exactly Rp 20.000. The bound is inclusive.
        fillValidForm();
        useRedeemStore.getState().setAmountCurrency("IDR");
        useRedeemStore.getState().setAmount("25253");

        const result = await renderWithMin();
        expect(result.current.netPayoutIdr).toBe(MIN_REDEEM_IDR);
        expect(result.current.belowMinPayout).toBe(false);
        expect(result.current.isFormValid).toBe(true);
      });

      test("no minimum is asserted while the backend sends no minRedeemIdr", async () => {
        // The backend half of USDX-682 merges AFTER this app does, so for the whole
        // rollout window the field is simply absent. The app states no minimum of
        // its own then — it does not fall back to a number nobody chose, and it does
        // not close the screen either. POST /api/v2/redeem still enforces the real
        // bound and its 422 shows in the Ringkasan.
        const { minRedeemIdr: _absent, ...withoutRedeemMin } = config();
        getAppConfigMock.mockResolvedValue(withoutRedeemMin);
        fillValidForm();
        useRedeemStore.getState().setAmount("1"); // net Rp 10.523 — under Rp 20.000

        const result = await renderWithoutMin();
        expect(result.current.redeem.minRedeemIdr).toBeNull();
        expect(result.current.redeem.netPayoutIdr).toBe(10_523);
        expect(result.current.redeem.belowMinPayout).toBe(false);
        expect(result.current.redeem.isFormValid).toBe(true);
      });

      test("a failed config load asserts no minimum either", async () => {
        getAppConfigMock.mockRejectedValue(new Error("500"));
        fillValidForm();
        useRedeemStore.getState().setAmount("1");

        const result = await renderWithoutMin({ expectError: true });
        expect(result.current.redeem.minRedeemIdr).toBeNull();
        expect(result.current.redeem.belowMinPayout).toBe(false);
        expect(result.current.redeem.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("one rupiah under the minimum is rejected, in rupiah", async () => {
        // Rp 25.252 gross → net Rp 19.999, one rupiah under. The message carries the
        // configured figure formatted as rupiah — never a USDX amount.
        fillValidForm();
        useRedeemStore.getState().setAmountCurrency("IDR");
        useRedeemStore.getState().setAmount("25252");

        const result = await renderWithMin();
        expect(result.current.netPayoutIdr).toBe(19_999);
        expect(result.current.belowMinPayout).toBe(true);
        expect(result.current.minPayoutVars).toEqual({ amount: "Rp 20.000" });
        expect(result.current.isFormValid).toBe(false);
        // The amount itself is fine — only the money that would land is not.
        expect(result.current.amountError).toBeNull();
      });

      test("moving the threshold in the back office moves the app's bound", async () => {
        // Same 2 USDX redeem, two fee configs, no rebuild in between.
        fillValidForm();
        useRedeemStore.getState().setAmount("2");

        const passing = await renderWithMin();
        expect(passing.current.netPayoutIdr).toBe(26_046);
        expect(passing.current.belowMinPayout).toBe(false);

        getAppConfigMock.mockResolvedValue(config({ minRedeemIdr: "50000.00" }));
        const failing = await renderWithMin();
        await waitFor(() => expect(failing.current.minRedeemIdr).toBe(50_000));
        expect(failing.current.belowMinPayout).toBe(true);
        expect(failing.current.minPayoutVars).toEqual({ amount: "Rp 50.000" });
        expect(failing.current.isFormValid).toBe(false);
      });
    });

    describe("edge cases", () => {
      test("an empty amount reports no minimum breach", async () => {
        const result = await renderWithMin();
        expect(result.current.belowMinPayout).toBe(false);
        expect(result.current.minPayoutVars).toBeUndefined();
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
