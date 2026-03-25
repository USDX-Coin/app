import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useRedeem } from "@/hooks/useRedeem";
import { useRedeemStore } from "@/stores/redeemStore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

beforeEach(() => {
  useRedeemStore.getState().reset();
});

describe("useRedeem", () => {
  describe("validation", () => {
    describe("positive", () => {
      test("no errors when form is valid", () => {
        useRedeemStore.getState().setAmount("100");
        useRedeemStore.getState().setBankAccountId("bank_1");

        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toBeNull();
        expect(result.current.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("amountError for invalid amounts", () => {
        useRedeemStore.getState().setAmount("5");

        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toContain("Minimum");
      });

      test("isFormValid false without bankAccountId", () => {
        useRedeemStore.getState().setAmount("100");

        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        expect(result.current.isFormValid).toBe(false);
      });
    });

    describe("edge cases", () => {
      test("lazy validation - no error when empty", () => {
        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        expect(result.current.amountError).toBeNull();
      });
    });
  });

  describe("calculations", () => {
    describe("positive", () => {
      test("receiveAmount = parsedAmount - fee", () => {
        useRedeemStore.getState().setAmount("1000");

        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        expect(result.current.fee).toBeCloseTo(7, 2);
        expect(result.current.receiveAmount).toBeCloseTo(993, 0);
      });
    });

    describe("edge cases", () => {
      test("calculations with zero amount", () => {
        useRedeemStore.getState().setAmount("0");

        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        expect(result.current.parsedAmount).toBe(0);
        expect(result.current.fee).toBe(0);
        expect(result.current.receiveAmount).toBe(0);
      });
    });
  });

  describe("step machine", () => {
    describe("positive", () => {
      test("goToReview sets step to review", () => {
        useRedeemStore.getState().setAmount("100");
        useRedeemStore.getState().setBankAccountId("bank_1");

        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.goToReview();
        });

        expect(useRedeemStore.getState().step).toBe("review");
      });
    });

    describe("negative", () => {
      test("goToReview blocked when form invalid", () => {
        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.goToReview();
        });

        expect(useRedeemStore.getState().step).toBe("form");
      });
    });

    describe("edge cases", () => {
      test("form data preserved after goBackToForm", () => {
        useRedeemStore.getState().setAmount("500");
        useRedeemStore.getState().setBankAccountId("bank_1");
        useRedeemStore.getState().setStep("review");

        const { result } = renderHook(() => useRedeem(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.goBackToForm();
        });

        expect(useRedeemStore.getState().amount).toBe("500");
        expect(useRedeemStore.getState().bankAccountId).toBe("bank_1");
      });
    });
  });
});
