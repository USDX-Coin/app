import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { TRANSFER_POLL_MS, useWalletTransferTracker } from "@/hooks/useWalletTransferTracker";
import { useTransactions } from "@/hooks/useTransactions";
import { getWalletTransfer } from "@/lib/api/wallet-api";
import { listTransactions } from "@/lib/api/transactions-api";
import { ApiError } from "@/lib/api/client";
import { MOCK_WALLET_TRANSFER_FIXTURES as FX } from "@/lib/api/mock-wallet-transfer-fixtures";
import type { WalletTransfer } from "@/types";

vi.mock("@/lib/api/wallet-api", () => ({ getWalletTransfer: vi.fn() }));
vi.mock("@/lib/api/transactions-api", () => ({ listTransactions: vi.fn() }));
const getMock = vi.mocked(getWalletTransfer);
const listMock = vi.mocked(listTransactions);

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

    test("reaching a final status refreshes the cached /history list once, so list and detail agree (review app#79, USDX-713)", async () => {
      listMock.mockResolvedValue({ data: [], metadata: { page: 1, limit: 10, total: 0 } });
      getMock.mockResolvedValueOnce(pending).mockResolvedValue(confirmed);
      const { result } = renderHook(
        () => ({ tracker: useWalletTransferTracker(ID), history: useTransactions({ page: 1, take: 10, type: "TRANSFER_OUT" }) }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.history.isSuccess).toBe(true));
      await waitFor(() => expect(result.current.tracker.status).toBe("PENDING"));
      expect(listMock).toHaveBeenCalledTimes(1); // PENDING does not touch the list

      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS + 50);
      await waitFor(() => expect(result.current.tracker.status).toBe("CONFIRMED"));
      await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));

      await vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 3);
      expect(listMock).toHaveBeenCalledTimes(2); // once, not on every render
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
