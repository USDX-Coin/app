import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useMint } from "@/hooks/useMint";
import { useMintStore } from "@/stores/mintStore";
import { useAuthStore } from "@/stores/authStore";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
// mock rate: baseRate 16000 × (1 + 2.5%) = 16400
const EFFECTIVE_RATE = 16400;

beforeEach(() => {
  useMintStore.getState().reset();
  useAuthStore.setState({ token: null });
  pushMock.mockReset();
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
    test("submitMint creates the order and hands off to checkout with the bearer token in the URL hash (USDX-240)", async () => {
      // useMint redirects via window.location.href to mint.usdx.co.id/checkout/{id}#token=<jwt>.
      const originalLocation = window.location;
      const locationStub = { href: "" } as Location;
      Object.defineProperty(window, "location", { configurable: true, value: locationStub });

      try {
        useAuthStore.setState({ token: "tok/abc" });
        useMintStore.getState().setAmount("100");
        useMintStore.getState().setDestinationAddress(VALID_ADDRESS);
        const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isFormValid).toBe(true));
        await act(async () => {
          await result.current.submitMint();
        });

        expect(locationStub.href).toContain("/checkout/mint_");
        // Token di-handoff via URL hash, URL-encoded (USDX-240, supersede cookie).
        expect(locationStub.href).toContain("#token=tok%2Fabc");
      } finally {
        Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
      }
    });
  });
});
