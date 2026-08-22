import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useMint } from "@/hooks/useMint";
import { useMintStore } from "@/stores/mintStore";
import { useAuthStore } from "@/stores/authStore";
import { mintCheckoutCode } from "@/lib/api/auth-api";

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

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
// mock rate: baseRate 16000 × (1 + 2.5%) = 16400
const EFFECTIVE_RATE = 16400;

beforeEach(() => {
  useMintStore.getState().reset();
  useAuthStore.setState({ token: null });
  pushMock.mockReset();
  mintCheckoutCodeMock.mockReset();
  mintCheckoutCodeMock.mockResolvedValue("handoff-xyz");
});

describe("useMint", () => {
  describe("validation", () => {
    describe("positive", () => {
      test("no errors and form valid once the rate has loaded", async () => {
        useMintStore.getState().setAmount("100");
        useMintStore.getState().setDestinationAddress(VALID_ADDRESS);

        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.effectiveBuyRate).toBe(EFFECTIVE_RATE));
        expect(result.current.amountError).toBeNull();
        expect(result.current.addressError).toBeNull();
        expect(result.current.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("amountError for USD amount below minimum (rate-independent)", () => {
        useMintStore.getState().setAmount("5");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        expect(result.current.amountError).toContain("Minimum");
      });

      test("amountError for USD amount above maximum", () => {
        useMintStore.getState().setAmount("2000000");
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
        expect(result.current.amountError).toContain("Maximum");
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
