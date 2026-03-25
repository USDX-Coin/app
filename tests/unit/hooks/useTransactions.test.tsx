import { describe, test, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useTransactions } from "@/hooks/useTransactions";

describe("useTransactions", () => {
  describe("positive", () => {
    test("returns transaction data", async () => {
      const { result } = renderHook(() => useTransactions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.length).toBe(10);
    });

    test("starts in loading state", () => {
      const { result } = renderHook(() => useTransactions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });
});
