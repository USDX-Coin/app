import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useTransactions } from "@/hooks/useTransactions";
import * as transactionsApi from "@/lib/api/transactions-api";
import type { Paginated } from "@/lib/api/client";
import type { ConsumerTransaction } from "@/types";

const PAGE: Paginated<ConsumerTransaction> = {
  data: [
    {
      id: "t1",
      type: "MINT",
      amount: "100",
      subtotalIdr: "1640000.00",
      totalPayIdr: "1668000.00",
      effectiveRate: "16400",
      chain: "polygon",
      paymentStatus: "PAID",
      status: "COMPLETED",
      txHash: "0xabc",
      createdAt: "2026-06-10T09:00:00Z",
      updatedAt: "2026-06-10T09:00:00Z",
    },
  ],
  metadata: { page: 1, limit: 10, total: 1 },
};

describe("useTransactions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("positive", () => {
    test("returns the paginated history envelope", async () => {
      const spy = vi
        .spyOn(transactionsApi, "listTransactions")
        .mockResolvedValue(PAGE);

      const { result } = renderHook(() => useTransactions({ page: 1, take: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.metadata.total).toBe(1);
      expect(spy).toHaveBeenCalledWith({ page: 1, take: 10 });
    });

    test("starts in loading state", () => {
      vi.spyOn(transactionsApi, "listTransactions").mockResolvedValue(PAGE);

      const { result } = renderHook(() => useTransactions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("forwards the type filter to the API (mint-only W2)", async () => {
      const spy = vi
        .spyOn(transactionsApi, "listTransactions")
        .mockResolvedValue(PAGE);

      const { result } = renderHook(
        () => useTransactions({ page: 1, take: 10, type: "MINT" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({ page: 1, take: 10, type: "MINT" });
    });
  });
});
