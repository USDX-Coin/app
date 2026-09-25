import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { TransferResult } from "@/components/transfer/TransferResult";
import { TRANSFER_POLL_MS } from "@/hooks/useWalletTransferTracker";
import { getWalletTransfer } from "@/lib/api/wallet-api";
import { ApiError } from "@/lib/api/client";
import type { TransferAccepted, WalletTransfer } from "@/types";

vi.mock("@/lib/api/wallet-api", () => ({ getWalletTransfer: vi.fn() }));
const getMock = vi.mocked(getWalletTransfer);

const ACCEPTED: TransferAccepted = {
  id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e77",
  txHash: "0x" + "ab".repeat(32),
  from: "0x000000C528aE908fB929a0898B65e913623c9aFf",
  to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  amount: "25.000000",
  amountWei: "25000000",
  chain: "polygon",
  submittedAt: "2026-08-28T04:20:11.000Z",
};

function detail(overrides: Partial<WalletTransfer> = {}): WalletTransfer {
  return {
    ...ACCEPTED,
    status: "PENDING",
    failureReason: null,
    blockNumber: null,
    finalizedAt: null,
    ...overrides,
  };
}

function renderResult(result: TransferAccepted = ACCEPTED) {
  const Wrapper = createWrapper();
  const ui = (r: TransferAccepted) => (
    <Wrapper>
      <LanguageProvider>
        <TransferResult result={r} onAgain={() => {}} />
      </LanguageProvider>
    </Wrapper>
  );
  const utils = render(ui(result));
  return { ...utils, rerenderWith: (r: TransferAccepted) => utils.rerender(ui(r)) };
}

const statusOf = () => screen.getByTestId("transfer-status").getAttribute("data-status");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// Tracker sesudah kirim (USDX-701): 202 = broadcast, bukan konfirmasi. Layar mulai di
// "menunggu konfirmasi" dan berpindah sendiri ke Berhasil/Gagal.
describe("TransferResult (tracker after send)", () => {
  describe("positive", () => {
    test("starts as 'sent, waiting for confirmation' and turns successful without a reload", async () => {
      getMock.mockResolvedValueOnce(detail()).mockResolvedValue(detail({ status: "CONFIRMED", blockNumber: 1, finalizedAt: "2026-08-28T04:21:40.000Z" }));
      renderResult();

      expect(statusOf()).toBe("PENDING");
      expect(screen.getByText("Terkirim, menunggu konfirmasi")).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS + 100));
      await waitFor(() => expect(statusOf()).toBe("CONFIRMED"));
      expect(screen.getByText("Transfer berhasil")).toBeInTheDocument();
      expect(getMock).toHaveBeenCalledWith(ACCEPTED.id);
    });

    test("FAILED says the USDX did not move and it is safe to send again, with the reason", async () => {
      getMock.mockResolvedValue(detail({ status: "FAILED", failureReason: "REVERTED", finalizedAt: "2026-08-28T04:21:40.000Z" }));
      renderResult();

      await waitFor(() => expect(statusOf()).toBe("FAILED"));
      expect(screen.getByText("Transfer gagal")).toBeInTheDocument();
      expect(screen.getByText("USDX Anda tidak berpindah. Aman untuk mengirim ulang.")).toBeInTheDocument();
      expect(screen.getByTestId("transfer-failure-reason")).toHaveTextContent("Ditolak oleh kontrak token USDX");
    });

    test("keeps the explorer link and a way to the transfer history", async () => {
      getMock.mockResolvedValue(detail());
      renderResult();

      const link = screen.getByRole("link", { name: "Lihat di explorer" });
      expect(link).toHaveAttribute("href", `https://polygonscan.com/tx/${ACCEPTED.txHash}`);
      expect(screen.getByRole("link", { name: /Riwayat transfer/ })).toHaveAttribute("href", "/history?type=TRANSFER_OUT");
    });
  });

  describe("negative", () => {
    test("no 'berhasil' anywhere before the backend says CONFIRMED", async () => {
      getMock.mockResolvedValue(detail());
      renderResult();

      await waitFor(() => expect(getMock).toHaveBeenCalled());
      await act(() => vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 3));
      expect(statusOf()).toBe("PENDING");
      expect(document.body.textContent).not.toMatch(/berhasil/i);
    });

    test("a failed status check keeps the transfer as sent and says so, never 'failed'", async () => {
      getMock.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x"));
      renderResult();

      // One retry (hook default) before the query reports the error.
      await act(() => vi.advanceTimersByTimeAsync(1_500));
      await waitFor(() => expect(screen.getByTestId("transfer-status-check-failed")).toBeInTheDocument());
      expect(statusOf()).toBe("PENDING");
      expect(screen.queryByText("Transfer gagal")).not.toBeInTheDocument();
    });
  });

  describe("edge case", () => {
    test("an unknown status renders exactly like PENDING", async () => {
      getMock.mockResolvedValue(detail({ status: "SETTLING" }));
      renderResult();

      await waitFor(() => expect(getMock).toHaveBeenCalled());
      await act(() => vi.advanceTimersByTimeAsync(50));
      expect(statusOf()).toBe("PENDING");
      expect(screen.getByText("Terkirim, menunggu konfirmasi")).toBeInTheDocument();
      expect(screen.getByTestId("transfer-status-badge")).toHaveTextContent("Menunggu konfirmasi");
      expect(screen.queryByText("SETTLING")).not.toBeInTheDocument();
    });

    test("a 202 without id (backend older than USDX-576) stays 'waiting' with the explorer link, no request", async () => {
      // `TransferAccepted.id` is additive and not `required` in wallet.yaml.
      const { id: _drop, ...legacy } = ACCEPTED;
      void _drop;
      renderResult(legacy as TransferAccepted);
      await act(() => vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS * 2));

      expect(getMock).not.toHaveBeenCalled();
      expect(statusOf()).toBe("PENDING");
      expect(screen.getByRole("link", { name: "Lihat di explorer" })).toBeInTheDocument();
      expect(screen.queryByTestId("transfer-status-check-failed")).not.toBeInTheDocument();
    });

    test("a 200 replay with the same id keeps ONE tracker on that id", async () => {
      getMock.mockResolvedValue(detail());
      const { rerenderWith } = renderResult();
      await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

      // Replay: identical TransferAccepted (same id) arrives again.
      rerenderWith({ ...ACCEPTED });
      await act(() => vi.advanceTimersByTimeAsync(TRANSFER_POLL_MS + 100));

      expect(screen.getAllByTestId("transfer-status")).toHaveLength(1);
      expect(new Set(getMock.mock.calls.map((c) => c[0]))).toEqual(new Set([ACCEPTED.id]));
      expect(getMock).toHaveBeenCalledTimes(2); // first fetch + one 3 s poll, not doubled
    });
  });
});
