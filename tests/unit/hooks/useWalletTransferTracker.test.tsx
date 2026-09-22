import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { TRANSFER_POLL_MS, useWalletTransferTracker } from "@/hooks/useWalletTransferTracker";
import { RATE_LIMIT_RETRIES, useWalletTransfers } from "@/hooks/useWalletTransfers";
import { getWalletTransfer, listWalletTransfers } from "@/lib/api/wallet-api";
import { ApiError } from "@/lib/api/client";
import { MOCK_WALLET_TRANSFER_FIXTURES as FX } from "@/lib/api/mock-wallet-transfer-fixtures";
import type { WalletTransfer } from "@/types";

vi.mock("@/lib/api/wallet-api", () => ({
  getWalletTransfer: vi.fn(),
  listWalletTransfers: vi.fn(),
}));
const getMock = vi.mocked(getWalletTransfer);
const listMock = vi.mocked(listWalletTransfers);

const ID = FX.pending.id;
const pending: WalletTransfer = FX.pending;
const confirmed: WalletTransfer = { ...FX.pending, status: "CONFIRMED", blockNumber: 1, finalizedAt: "2026-08-28T04:41:30.000Z" };
const failed: WalletTransfer = { ...FX.pending, status: "FAILED", failureReason: "DROPPED", finalizedAt: "2026-08-28T04:44:00.000Z" };

function notFound() {
  return new ApiError(404, "WALLET_TRANSFER_NOT_FOUND", "Transfer tidak ditemukan");
}
function rateLimited(seconds: number) {
  return new ApiError(429, "RATE_LIMITED", "x", undefined, seconds);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getMock.mockReset();
  listMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// Tracker konfirmasi (wallet.yaml § transfer-detail, USDX-701): poll ≥ 3 detik, berhenti
// di CONFIRMED/FAILED, tidak pernah menyimpulkan gagal dari umur.
describe("useWalletTransferTracker", () => {
  describe("positive", () => {
    test("moves PENDING → CONFIRMED without a reload, then stops polling", async () => {
      getMock.mockResolvedValueOnce(pending).mockResolvedValue(confirmed);
      const { result } = renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.status).toBe("PENDING"));
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS + 50);
      await waitFor(() => expect(result.current.status).toBe("CONFIRMED"));
      const calls = getMock.mock.calls.length;

      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 5);
      expect(getMock).toHaveBeenCalledTimes(calls);
      expect(getMock).toHaveBeenCalledWith(ID);
    });

    test("FAILED is final too — polling stops", async () => {
      getMock.mockResolvedValueOnce(pending).mockResolvedValue(failed);
      const { result } = renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.status).toBe("PENDING"));
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS + 50);
      await waitFor(() => expect(result.current.status).toBe("FAILED"));
      const calls = getMock.mock.calls.length;
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 5);
      expect(getMock).toHaveBeenCalledTimes(calls);
    });
  });

  describe("negative", () => {
    test("404 WALLET_TRANSFER_NOT_FOUND → notFound, no retry, no further polling", async () => {
      getMock.mockRejectedValue(notFound());
      const { result } = renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.notFound).toBe(true));
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 5);
      expect(getMock).toHaveBeenCalledTimes(1);
      expect(result.current.transfer).toBeNull();
    });

    test("422 VALIDATION_ERROR (id is not a UUID) is read as not found — no retry, no poll", async () => {
      getMock.mockRejectedValue(new ApiError(422, "VALIDATION_ERROR", "id harus UUID"));
      const { result } = renderHook(() => useWalletTransferTracker("not-a-uuid"), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.notFound).toBe(true));
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 3);
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    test("no id → nothing is fetched", async () => {
      renderHook(() => useWalletTransferTracker(null), { wrapper: createWrapper() });
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 3);
      expect(getMock).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("the interval is never shorter than 3 seconds", async () => {
      getMock.mockResolvedValue(pending);
      renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS - 100);
      expect(getMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(200);
      await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    });

    test("an old PENDING stays PENDING and keeps being polled — age never means failed", async () => {
      const ancient = { ...pending, submittedAt: "2020-01-01T00:00:00.000Z" };
      getMock.mockResolvedValue(ancient);
      const { result } = renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 4 + 100);
      expect(result.current.status).toBe("PENDING");
      expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    test("an unknown status is read as PENDING and polling continues", async () => {
      getMock.mockResolvedValue({ ...pending, status: "SETTLING" });
      const { result } = renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.status).toBe("PENDING"));
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 2 + 100);
      expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    test("429 backs off to Retry-After instead of the 3 s interval", async () => {
      getMock.mockRejectedValueOnce(rateLimited(10)).mockResolvedValue(pending);
      renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 3); // 9 s < Retry-After 10 s
      expect(getMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_200);
      await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    });

    test("leaving the screen (unmount) stops the poll", async () => {
      getMock.mockResolvedValue(pending);
      const { unmount } = renderHook(() => useWalletTransferTracker(ID), { wrapper: createWrapper() });

      await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
      unmount();
      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 5);
      expect(getMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe("useWalletTransfers", () => {
  describe("positive", () => {
    test("forwards page/take and returns the paginated envelope", async () => {
      listMock.mockResolvedValue({ data: [FX.confirmed], metadata: { page: 2, limit: 10, total: 11 } });
      const { result } = renderHook(() => useWalletTransfers({ page: 2, take: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listMock).toHaveBeenCalledWith({ page: 2, take: 10 });
      expect(result.current.data?.metadata.total).toBe(11);
    });
  });

  describe("negative", () => {
    test("a failed list is an error, not an empty success", async () => {
      vi.useRealTimers();
      listMock.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x"));
      const { result } = renderHook(() => useWalletTransfers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3_000 }); // one retry
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("edge case", () => {
    test("429 waits Retry-After and tries again before giving up", async () => {
      vi.useRealTimers(); // real clock: the retry sleep is TanStack's own timer
      listMock
        .mockRejectedValueOnce(rateLimited(2))
        .mockResolvedValue({ data: [FX.confirmed], metadata: { page: 1, limit: 10, total: 1 } });
      const { result } = renderHook(() => useWalletTransfers(), { wrapper: createWrapper() });

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
      const { result } = renderHook(() => useWalletTransfers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4_000 });
      expect(listMock).toHaveBeenCalledTimes(RATE_LIMIT_RETRIES + 1);
    });

    test("an empty list is a success with no rows", async () => {
      listMock.mockResolvedValue({ data: [], metadata: { page: 1, limit: 10, total: 0 } });
      const { result } = renderHook(() => useWalletTransfers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toEqual([]);
    });
  });
});
