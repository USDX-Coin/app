import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import {
  HISTORY_REFRESH_MS,
  RATE_LIMIT_RETRIES,
  useTransactions,
} from "@/hooks/useTransactions";
import { listTransactions } from "@/lib/api/transactions-api";
import { ApiError } from "@/lib/api/client";
import { MOCK_INCOMING_TRANSFER_FIXTURES as IN } from "@/lib/api/mock-wallet-transfer-fixtures";
import type { HistoryItem } from "@/types";

vi.mock("@/lib/api/transactions-api", () => ({ listTransactions: vi.fn() }));
const listMock = vi.mocked(listTransactions);

function pageOf(rows: HistoryItem[]) {
  return { data: rows, metadata: { page: 1, limit: 10, total: rows.length } };
}
function rateLimited(seconds: number) {
  return new ApiError(429, "RATE_LIMITED", "x", undefined, seconds);
}

const pending: HistoryItem = IN.pending;
const confirmed: HistoryItem = { ...IN.pending, status: "CONFIRMED" };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  listMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// Penyegaran riwayat terpadu (custodial-wallet.md §5.7, USDX-713): selama daftar yang
// tampil memuat transfer PENDING, segarkan tiap 15 detik; berhenti bila tidak ada PENDING
// lagi; 429 → hormati Retry-After.
describe("useTransactions — refresh while a transfer is pending", () => {
  describe("positive", () => {
    test("a PENDING transfer on screen → refetch every 15 s until it is CONFIRMED", async () => {
      listMock.mockResolvedValueOnce(pageOf([pending])).mockResolvedValue(pageOf([confirmed]));
      const { result } = renderHook(() => useTransactions({ includeTransfers: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_MS + 50);
      await waitFor(() =>
        expect((result.current.data?.data[0] as { status: string }).status).toBe("CONFIRMED"),
      );
      const calls = listMock.mock.calls.length;

      // Nothing pending any more → no further polling.
      await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_MS * 4);
      expect(listMock).toHaveBeenCalledTimes(calls);
    });

    test("a status the app does not know counts as pending (it is shown as pending)", async () => {
      listMock.mockResolvedValue(pageOf([{ ...IN.pending, status: "FINALIZING" }]));
      const { result } = renderHook(() => useTransactions({ type: "TRANSFER_IN" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_MS + 50);
      await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    });
  });

  describe("negative", () => {
    test("no PENDING row → no periodic refresh", async () => {
      listMock.mockResolvedValue(pageOf([confirmed]));
      const { result } = renderHook(() => useTransactions({ includeTransfers: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_MS * 4);
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    test("a failed list is an error, not an empty success", async () => {
      vi.useRealTimers();
      listMock.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x"));
      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3_000 }); // one retry
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("edge case", () => {
    test("429 waits Retry-After and tries again before giving up", async () => {
      vi.useRealTimers(); // real clock: the retry sleep is TanStack's own timer
      listMock.mockRejectedValueOnce(rateLimited(2)).mockResolvedValue(pageOf([confirmed]));
      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
      // Past the default 1 s retry delay, still short of Retry-After 2 s.
      await new Promise((r) => setTimeout(r, 1_500));
      expect(listMock).toHaveBeenCalledTimes(1);
      expect(result.current.isError).toBe(false);
      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2_000 });
      expect(listMock).toHaveBeenCalledTimes(2);
    });

    test("a 429 that persists ends in the error state after the bounded retries", async () => {
      vi.useRealTimers();
      listMock.mockRejectedValue(rateLimited(1));
      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4_000 });
      expect(listMock).toHaveBeenCalledTimes(RATE_LIMIT_RETRIES + 1);
    });

    test("a refresh answered 429 waits at least Retry-After before the next one", async () => {
      listMock
        .mockResolvedValueOnce(pageOf([pending]))
        .mockRejectedValueOnce(rateLimited(40))
        .mockRejectedValueOnce(rateLimited(40))
        .mockRejectedValueOnce(rateLimited(40))
        .mockResolvedValue(pageOf([pending]));
      const { result } = renderHook(() => useTransactions({ includeTransfers: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_MS + 50);
      // The refresh + its Retry-After retries (40 s each).
      await vi.advanceTimersByTimeAsync(40_000 * RATE_LIMIT_RETRIES + 100);
      await waitFor(() => expect(listMock).toHaveBeenCalledTimes(RATE_LIMIT_RETRIES + 2));
      // The rows stay on screen; the next refresh waits Retry-After (40 s), not 15 s.
      expect(result.current.data?.data).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_MS + 50);
      expect(listMock).toHaveBeenCalledTimes(RATE_LIMIT_RETRIES + 2);
      await vi.advanceTimersByTimeAsync(40_000);
      await waitFor(() => expect(listMock).toHaveBeenCalledTimes(RATE_LIMIT_RETRIES + 3));
    });
  });
});
