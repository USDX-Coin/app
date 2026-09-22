import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { TransferDetail } from "@/components/transfer/TransferDetail";
import { getWalletTransfer } from "@/lib/api/wallet-api";
import { ApiError } from "@/lib/api/client";
import { MOCK_WALLET_TRANSFER_FIXTURES as FX } from "@/lib/api/mock-wallet-transfers";

vi.mock("@/lib/api/wallet-api", () => ({ getWalletTransfer: vi.fn() }));
const getMock = vi.mocked(getWalletTransfer);

function renderDetail(id: string) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <LanguageProvider>
        <TransferDetail id={id} />
      </LanguageProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  getMock.mockReset();
});

// Detail transfer (USDX-701): id basi/salah → pesan netral + kembali ke riwayat.
describe("TransferDetail", () => {
  describe("positive", () => {
    test("renders the transfer with its status and a way back to the history", async () => {
      getMock.mockResolvedValue(FX.confirmed);
      renderDetail(FX.confirmed.id);

      await waitFor(() => expect(screen.getByTestId("transfer-status")).toHaveAttribute("data-status", "CONFIRMED"));
      expect(screen.getByText("Transfer berhasil")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Kembali ke riwayat transfer/ })).toHaveAttribute("href", "/send/history");
      expect(getMock).toHaveBeenCalledWith(FX.confirmed.id);
    });

    test("a DROPPED transfer shows the failure with its plain-language reason", async () => {
      getMock.mockResolvedValue(FX.dropped);
      renderDetail(FX.dropped.id);

      await waitFor(() => expect(screen.getByText("Transfer gagal")).toBeInTheDocument());
      expect(screen.getByTestId("transfer-failure-reason")).toHaveTextContent(
        "Digantikan transaksi lain dari wallet yang sama",
      );
    });
  });

  describe("negative", () => {
    test("404 WALLET_TRANSFER_NOT_FOUND → neutral message + back to history, no error styling", async () => {
      getMock.mockRejectedValue(new ApiError(404, "WALLET_TRANSFER_NOT_FOUND", "Transfer tidak ditemukan"));
      renderDetail(FX.confirmed.id);

      await waitFor(() => expect(screen.getByTestId("transfer-detail-not-found")).toBeInTheDocument());
      expect(screen.getByText("Transfer tidak ditemukan")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Kembali ke riwayat transfer/ })).toHaveAttribute("href", "/send/history");
      expect(screen.queryByTestId("transfer-detail-error")).not.toBeInTheDocument();
    });

    test("a server failure is an error with retry — not 'not found'", async () => {
      getMock.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x"));
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderDetail(FX.confirmed.id);

      await act(() => vi.advanceTimersByTimeAsync(1_500)); // hook retries once
      await waitFor(() => expect(screen.getByTestId("transfer-detail-error")).toBeInTheDocument());
      expect(screen.queryByTestId("transfer-detail-not-found")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  describe("edge case", () => {
    test("a mistyped id (422) gets the same neutral not-found screen", async () => {
      getMock.mockRejectedValue(new ApiError(422, "VALIDATION_ERROR", "id harus UUID"));
      renderDetail("abc");

      await waitFor(() => expect(screen.getByTestId("transfer-detail-not-found")).toBeInTheDocument());
    });

    test("an unknown status is shown as waiting for confirmation", async () => {
      getMock.mockResolvedValue({ ...FX.pending, status: "SETTLING" });
      renderDetail(FX.pending.id);

      await waitFor(() => expect(screen.getByTestId("transfer-status")).toHaveAttribute("data-status", "PENDING"));
      expect(screen.getByText("Terkirim, menunggu konfirmasi")).toBeInTheDocument();
    });
  });
});
