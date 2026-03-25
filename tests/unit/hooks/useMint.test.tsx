import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useMint } from "@/hooks/useMint";
import { useMintStore } from "@/stores/mintStore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

beforeEach(() => {
  useMintStore.getState().reset();
});

describe("useMint", () => {
  describe("validation", () => {
    describe("positive", () => {
      test("no errors when form is valid", () => {
        useMintStore.getState().setAmount("100");
        useMintStore
          .getState()
          .setDestinationAddress(
            "0x1234567890abcdef1234567890abcdef12345678"
          );

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toBeNull();
        expect(result.current.addressError).toBeNull();
        expect(result.current.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("amountError for amount below minimum", () => {
        useMintStore.getState().setAmount("5");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toContain("Minimum");
      });

      test("amountError for amount above maximum", () => {
        useMintStore.getState().setAmount("2000000");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toContain("Maximum");
      });

      test("addressError for invalid EVM address", () => {
        useMintStore.getState().setDestinationAddress("0xinvalid");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.addressError).toBeTruthy();
      });

      test("addressError for non-0x address", () => {
        useMintStore.getState().setDestinationAddress("notanaddress");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.addressError).toBe("Address must start with 0x");
      });
    });

    describe("edge cases", () => {
      test("no validation when fields are empty (lazy validation)", () => {
        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toBeNull();
        expect(result.current.addressError).toBeNull();
        expect(result.current.isFormValid).toBe(false);
      });

      test("validates exact boundary amount (10)", () => {
        useMintStore.getState().setAmount("10");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toBeNull();
      });
    });
  });

  describe("calculations", () => {
    describe("positive", () => {
      test("parsedAmount correctly parses string to number", () => {
        useMintStore.getState().setAmount("1000");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.parsedAmount).toBe(1000);
      });

      test("fee is 0.7% of parsedAmount", () => {
        useMintStore.getState().setAmount("1000");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.fee).toBeCloseTo(7, 2);
      });

      test("selectedChain matches chainId", () => {
        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.selectedChain?.id).toBe("base");
      });
    });

    describe("edge cases", () => {
      test("calculations handle zero amount", () => {
        useMintStore.getState().setAmount("0");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.parsedAmount).toBe(0);
        expect(result.current.fee).toBe(0);
      });

      test("selectedChain undefined for invalid chainId", () => {
        useMintStore.getState().setChainId("nonexistent");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        expect(result.current.selectedChain).toBeUndefined();
      });
    });
  });

  describe("step machine", () => {
    describe("positive", () => {
      test("goToReview sets step to review when form valid", () => {
        useMintStore.getState().setAmount("100");
        useMintStore
          .getState()
          .setDestinationAddress(
            "0x1234567890abcdef1234567890abcdef12345678"
          );

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.goToReview();
        });

        expect(useMintStore.getState().step).toBe("review");
      });

      test("goBackToForm sets step to form", () => {
        useMintStore.getState().setStep("review");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.goBackToForm();
        });

        expect(useMintStore.getState().step).toBe("form");
      });
    });

    describe("negative", () => {
      test("goToReview does nothing when form invalid", () => {
        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.goToReview();
        });

        expect(useMintStore.getState().step).toBe("form");
      });
    });

    describe("edge cases", () => {
      test("form data preserved after goBackToForm", () => {
        useMintStore.getState().setAmount("500");
        useMintStore
          .getState()
          .setDestinationAddress(
            "0x1234567890abcdef1234567890abcdef12345678"
          );
        useMintStore.getState().setStep("review");

        const { result } = renderHook(() => useMint(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.goBackToForm();
        });

        expect(useMintStore.getState().amount).toBe("500");
        expect(useMintStore.getState().destinationAddress).toBe(
          "0x1234567890abcdef1234567890abcdef12345678"
        );
      });
    });
  });
});
