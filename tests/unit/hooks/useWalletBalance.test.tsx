import { describe, test, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useWalletBalance } from "@/hooks/useWalletBalance";

describe("useWalletBalance", () => {
  describe("positive", () => {
    test("returns balance when address is present", async () => {
      const { result } = renderHook(
        () => useWalletBalance("0x1234567890abcdef1234567890abcdef12345678"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(5000);
    });
  });

  describe("edge cases", () => {
    test("query disabled when address is undefined", () => {
      const { result } = renderHook(() => useWalletBalance(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });
});
