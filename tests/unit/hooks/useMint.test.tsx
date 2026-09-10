import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useMint } from "@/hooks/useMint";
import { useMintStore } from "@/stores/mintStore";
import { useAuthStore } from "@/stores/authStore";
import { mintCheckoutCode } from "@/lib/api/auth-api";
import { getAppConfig } from "@/lib/api/config-api";
import type { AppConfig } from "@/types";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

// USDX-378: the checkout handoff is a one-time code minted by the backend, not the
// app's stored session token. Mock it so the test controls the value and proves the
// app never reaches into its own storage for the handoff.
vi.mock("@/lib/api/auth-api", () => ({
  mintCheckoutCode: vi.fn(),
}));
const mintCheckoutCodeMock = vi.mocked(mintCheckoutCode);

// USDX-638: the mint minimum and the fee rates are backend-owned
// (GET /api/v2/config). Mocked so a test can move the minimum the way an admin
// would, and can fail the endpoint to prove the app invents nothing.
vi.mock("@/lib/api/config-api", () => ({
  getAppConfig: vi.fn(),
}));
const getAppConfigMock = vi.mocked(getAppConfig);

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
// mock rate: baseRate 16000 × (1 + 2.5%) = 16400
const EFFECTIVE_RATE = 16400;
// GET /api/v2/config defaults: Rp 20.000 minimum, 1% mint fee, Rp 4.000 flat VA.
const MIN_MINT_IDR = 20_000;
const VA_FEE_IDR = 4_000;

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    minMintIdr: "20000.00",
    mintFeePct: "1.0",
    pgFeeVaFlat: "4000.00",
    contractAddress: "0x1FF2000000000000000000000000000000000000",
    chain: "polygon",
    ...overrides,
  };
}

beforeEach(() => {
  useMintStore.getState().reset();
  useAuthStore.setState({ token: null });
  pushMock.mockReset();
  mintCheckoutCodeMock.mockReset();
  mintCheckoutCodeMock.mockResolvedValue("handoff-xyz");
  getAppConfigMock.mockReset();
  getAppConfigMock.mockResolvedValue(config());
});

describe("useMint", () => {
  // The minimum is a RUPIAH figure from GET /api/v2/config, judged on the order
  // subtotal from whichever side the user typed on (USDX-638). Before this, an
  // IDR entry was converted to USDX and compared to a hardcoded 10 — so Rp 20.000
  // was rejected with "Mint minimal 10 USDX", a bound worth Rp 176.182 that day.
  describe("validation", () => {
    // Renders the hook with the amount already entered, and waits for both
    // backend reads (rate + config) the validation depends on.
    async function withAmount(amount: string, currency: "USD" | "IDR" = "USD") {
      useMintStore.getState().setAmountCurrency(currency);
      useMintStore.getState().setAmount(amount);
      useMintStore.getState().setDestinationAddress(VALID_ADDRESS);
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
      await waitFor(() => {
        expect(result.current.effectiveBuyRate).toBe(EFFECTIVE_RATE);
        expect(result.current.isConfigReady).toBe(true);
      });
      return result;
    }

    describe("positive", () => {
      test("Rp 20.000 on the rupiah side passes and the form is mintable", async () => {
        const result = await withAmount(String(MIN_MINT_IDR), "IDR");

        expect(result.current.amountError).toBeNull();
        expect(result.current.addressError).toBeNull();
        expect(result.current.isFormValid).toBe(true);
      });

      test("no errors and form valid once the rate has loaded", async () => {
        const result = await withAmount("100");

        expect(result.current.amountError).toBeNull();
        expect(result.current.addressError).toBeNull();
        expect(result.current.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("Rp 19.000 on the rupiah side reports the rupiah minimum", async () => {
        const result = await withAmount("19000", "IDR");

        expect(result.current.amountError).toBe("validation.amount.minMint");
        // The number in the sentence is the config's, formatted id-ID —
        // "Nilai mint minimum Rp 20.000".
        expect(result.current.amountErrorVars).toEqual({ amount: "Rp 20.000" });
        expect(result.current.isFormValid).toBe(false);
      });

      test("the SAME amount entered on the USDX side reports the SAME error", async () => {
        // 1 USDX = Rp 16.400 → a Rp 16.400 subtotal, under the Rp 20.000 floor.
        const result = await withAmount("1", "USD");

        expect(result.current.subtotalIdr).toBe(EFFECTIVE_RATE);
        expect(result.current.amountError).toBe("validation.amount.minMint");
        expect(result.current.isFormValid).toBe(false);
      });

      test("amountError for USD amount above maximum", async () => {
        const result = await withAmount("2000000");
        expect(result.current.amountError).toBe("validation.amount.maxMint");
        // The ceiling keeps its OWN number. Every amount message shares the
        // `{amount}` placeholder, so shipping the config's rupiah figure with
        // every error rewrote this one into "Maximum mint is Rp 20.000 USDX".
        expect(result.current.amountErrorVars).toBeUndefined();
      });

      test("addressError for invalid EVM address", () => {
        useMintStore.getState().setDestinationAddress("0xinvalid");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        expect(result.current.addressError).toBeTruthy();
      });
    });

    describe("edge cases", () => {
      test("no validation when fields are empty (lazy)", () => {
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        expect(result.current.amountError).toBeNull();
        expect(result.current.addressError).toBeNull();
        expect(result.current.isFormValid).toBe(false);
      });

      test("form invalid until the rate is available", () => {
        useMintStore.getState().setAmount("100");
        useMintStore.getState().setDestinationAddress(VALID_ADDRESS);
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        // Synchronously (before the rate query resolves) the form can't be valid.
        expect(result.current.effectiveBuyRate).toBeNull();
        expect(result.current.isFormValid).toBe(false);
      });

      test("a subtotal exactly on the minimum is accepted", async () => {
        const result = await withAmount(String(MIN_MINT_IDR), "IDR");
        expect(result.current.subtotalIdr).toBe(MIN_MINT_IDR);
        expect(result.current.amountError).toBeNull();
      });

      test("moving the minimum in the back office moves the app's bound", async () => {
        // Same Rp 30.000 purchase, two different configs — no rebuild in between.
        getAppConfigMock.mockResolvedValue(config({ minMintIdr: "20000.00" }));
        const passing = await withAmount("30000", "IDR");
        expect(passing.current.amountError).toBeNull();

        getAppConfigMock.mockResolvedValue(config({ minMintIdr: "50000.00" }));
        const failing = await withAmount("30000", "IDR");
        expect(failing.current.amountError).toBe("validation.amount.minMint");
        expect(failing.current.amountErrorVars).toEqual({ amount: "Rp 50.000" });
      });
    });
  });

  // The config carries the only honest numbers the mint screen has. When it does
  // not arrive, the screen says so — it does not fall back to a guessed floor
  // that would reject a valid Rp 20.000, nor to a guessed fee on a payment total.
  describe("config unavailable", () => {
    describe("negative", () => {
      test("a failed config load disables Mint and invents no bound", async () => {
        getAppConfigMock.mockRejectedValue(new Error("500"));
        useMintStore.getState().setAmountCurrency("IDR");
        useMintStore.getState().setAmount("19000");
        useMintStore.getState().setDestinationAddress(VALID_ADDRESS);

        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isConfigError).toBe(true), { timeout: 5000 });
        expect(result.current.isConfigReady).toBe(false);
        expect(result.current.isFormValid).toBe(false);
        // No minimum was asserted against an amount the app cannot judge, and no
        // fee figure was made up for the review screen.
        expect(result.current.amountError).toBeNull();
        expect(result.current.minMintIdr).toBeNull();
        expect(result.current.vaFeeIdr).toBeNull();
        expect(result.current.totalPayIdr).toBeNull();
      });

      test("an otherwise valid form is not mintable while the config is missing", async () => {
        getAppConfigMock.mockRejectedValue(new Error("500"));
        useMintStore.getState().setAmount("100");
        useMintStore.getState().setDestinationAddress(VALID_ADDRESS);

        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.effectiveBuyRate).toBe(EFFECTIVE_RATE));
        await waitFor(() => expect(result.current.isConfigError).toBe(true), { timeout: 5000 });
        expect(result.current.isFormValid).toBe(false);
      });
    });
  });

  // What the user is about to be billed, shown BEFORE leaving for checkout
  // (USDX-638). The old review printed the subtotal under "Total Pembayaran" and
  // promised a fee later; on a Rp 20.000 order that hidden fee is 20%.
  describe("payment breakdown", () => {
    describe("positive", () => {
      test("itemises mint fee and flat VA fee into the total the user pays", async () => {
        useMintStore.getState().setAmountCurrency("IDR");
        useMintStore.getState().setAmount("100000");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isConfigReady).toBe(true));
        await waitFor(() => expect(result.current.subtotalIdr).toBe(100_000));

        expect(result.current.mintFeeIdr).toBe(1_000); // 1% of the subtotal
        expect(result.current.vaFeeIdr).toBe(VA_FEE_IDR); // flat, not a percentage
        expect(result.current.totalPayIdr).toBe(105_000);
      });

      test("the VA fee stays flat as the order grows", async () => {
        useMintStore.getState().setAmountCurrency("IDR");
        useMintStore.getState().setAmount("20000");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isConfigReady).toBe(true));
        await waitFor(() => expect(result.current.subtotalIdr).toBe(20_000));

        expect(result.current.vaFeeIdr).toBe(VA_FEE_IDR);
        expect(result.current.totalPayIdr).toBe(20_000 + 200 + VA_FEE_IDR);
      });
    });

    describe("edge cases", () => {
      test("no amount entered → no figures at all, not zeroes", async () => {
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isConfigReady).toBe(true));

        expect(result.current.mintFeeIdr).toBeNull();
        expect(result.current.vaFeeIdr).toBeNull();
        expect(result.current.totalPayIdr).toBeNull();
      });

      // The backend floors total_pay to whole rupiah (`floorTotalPayIdr`,
      // mint-order.pricing.ts). A USDX-denominated amount almost always produces
      // a fractional subtotal, so without the same flooring the review would
      // quote a rupiah more than the VA actually bills.
      test("a fractional subtotal is floored to whole rupiah, like the invoice", async () => {
        useMintStore.getState().setAmount("0.123"); // USD side
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isConfigReady).toBe(true));
        await waitFor(() => expect(result.current.subtotalIdr).toBeCloseTo(2017.2, 4));

        // 2017.20 subtotal + 20.17 mint fee (1%, settled to 2 dp) + 4000.00 VA
        // = 6037.37 → floored to 6037.
        expect(result.current.mintFeeIdr).toBe(20.17);
        expect(result.current.vaFeeIdr).toBe(4_000);
        expect(result.current.totalPayIdr).toBe(6_037);
      });

      test("components settle to 2 dp BEFORE the sum is floored", async () => {
        // 0.7 USDX × 16,400 = 11,480 exactly; a 0.755% fee lands on 86.674 and
        // must become 86.67 before the sum, which is what the backend stores.
        getAppConfigMock.mockResolvedValue(config({ mintFeePct: "0.755" }));
        useMintStore.getState().setAmount("0.7");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.mintFeeIdr).toBe(86.67));
        expect(result.current.totalPayIdr).toBe(15_566); // 11480 + 86.67 + 4000 = 15566.67
      });

      test("the total is always a whole number of rupiah", async () => {
        for (const amount of ["0.123", "1.7", "13.31"]) {
          useMintStore.getState().setAmount(amount);
          const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
          await waitFor(() => expect(result.current.totalPayIdr).not.toBeNull());
          expect(Number.isInteger(result.current.totalPayIdr)).toBe(true);
        }
      });
    });
  });

  describe("calculations", () => {
    describe("positive", () => {
      test("USD input: amountUsdx = entered, subtotalIdr = entered × rate", async () => {
        useMintStore.getState().setAmount("100");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.effectiveBuyRate).toBe(EFFECTIVE_RATE));
        expect(result.current.amountUsdx).toBe(100);
        expect(result.current.subtotalIdr).toBe(100 * EFFECTIVE_RATE);
      });

      test("IDR input: amountUsdx = entered / rate, subtotalIdr = entered", async () => {
        useMintStore.getState().setAmountCurrency("IDR");
        useMintStore.getState().setAmount(String(100 * EFFECTIVE_RATE));
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.effectiveBuyRate).toBe(EFFECTIVE_RATE));
        expect(result.current.amountUsdx).toBe(100);
        expect(result.current.subtotalIdr).toBe(100 * EFFECTIVE_RATE);
      });

      test("selectedChain is locked to Polygon", () => {
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        expect(result.current.selectedChain?.id).toBe("polygon");
      });
    });

    describe("edge cases", () => {
      test("zero amount yields zero derived amounts", async () => {
        useMintStore.getState().setAmount("0");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.effectiveBuyRate).toBe(EFFECTIVE_RATE));
        expect(result.current.amountUsdx).toBe(0);
        expect(result.current.subtotalIdr).toBe(0);
      });
    });
  });

  describe("currency toggle", () => {
    test("toggleCurrency switches USD <-> IDR", () => {
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
      expect(result.current.amountCurrency).toBe("USD");
      act(() => result.current.toggleCurrency());
      expect(useMintStore.getState().amountCurrency).toBe("IDR");
    });
  });

  describe("submit", () => {
    // Returns the redirect target plus the live hook result, so a test can assert
    // what the page looks like *after* the handoff was fired (the browser is still
    // navigating at that point — jsdom just records the href).
    async function submitAndCaptureRedirect(): Promise<{
      href: string;
      result: { current: ReturnType<typeof useMint> };
    }> {
      const originalLocation = window.location;
      const locationStub = { href: "" } as Location;
      Object.defineProperty(window, "location", { configurable: true, value: locationStub });
      try {
        useMintStore.getState().setAmount("100");
        useMintStore.getState().setDestinationAddress(VALID_ADDRESS);
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isFormValid).toBe(true));
        await act(async () => {
          await result.current.submitMint();
        });
        return { href: locationStub.href, result };
      } finally {
        Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
      }
    }

    describe("positive", () => {
      test("hands off to checkout with a freshly-minted one-time code in the URL hash (USDX-378)", async () => {
        // The app-side session token must NOT be read from storage — the handoff code
        // comes from POST /api/v2/auth/checkout-token instead (CLNT-12 fix), and the
        // URL carries `#code=`, never a session token / `#token=`.
        useAuthStore.setState({ token: "app-session-tok" });
        mintCheckoutCodeMock.mockResolvedValue("handoff/abc");

        const { href } = await submitAndCaptureRedirect();

        expect(href).toContain("/checkout/mint_");
        // URL-encoded minted one-time code (USDX-378 URL-hash handoff).
        expect(href).toContain("#code=handoff%2Fabc");
        // No legacy `#token=` handoff, and the app's own stored session token is
        // never leaked into the redirect.
        expect(href).not.toContain("#token=");
        expect(href).not.toContain("app-session-tok");
        expect(mintCheckoutCodeMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("edge cases", () => {
      test("still redirects (without a code hash) when minting the handoff code fails", async () => {
        // Graceful degradation: a failed mint must not strand the user — checkout will
        // prompt its own login. Mirrors the old token-absent behaviour.
        mintCheckoutCodeMock.mockRejectedValue(new Error("boom"));

        const { href } = await submitAndCaptureRedirect();

        expect(href).toContain("/checkout/mint_");
        expect(href).not.toContain("#code=");
      });
    });
  });

  // Handoff latch. The order is created and the browser is on its way to checkout —
  // a cross-origin load that takes as long as it takes. The create mutation is
  // already back to idle by then, so `isCreating` alone would re-enable "Lanjut
  // Pembayaran" mid-navigation and a second click would buy the same mint twice.
  describe("handoff latch", () => {
    async function submit(): Promise<{ current: ReturnType<typeof useMint> }> {
      const originalLocation = window.location;
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { href: "" } as Location,
      });
      try {
        useMintStore.getState().setAmount("100");
        useMintStore.getState().setDestinationAddress(VALID_ADDRESS);
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isFormValid).toBe(true));
        await act(async () => {
          await result.current.submitMint();
        });
        return result;
      } finally {
        Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
      }
    }

    describe("positive", () => {
      test("stays engaged after the create mutation settles, so confirm cannot fire twice", async () => {
        const result = await submit();

        await waitFor(() => expect(result.current.isCreating).toBe(false));
        expect(useMintStore.getState().handoffPending).toBe(true);
        expect(result.current.isHandingOff).toBe(true);
        expect(result.current.isSubmitting).toBe(true);
      });
    });

    describe("edge cases", () => {
      test("engages even when minting the handoff code fails (still redirects)", async () => {
        mintCheckoutCodeMock.mockRejectedValue(new Error("boom"));

        const result = await submit();

        expect(useMintStore.getState().handoffPending).toBe(true);
        expect(result.current.isSubmitting).toBe(true);
      });

      test("is not engaged before a submit — the confirm button starts live", () => {
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        expect(result.current.isHandingOff).toBe(false);
        expect(result.current.isSubmitting).toBe(false);
      });
    });
  });
});
