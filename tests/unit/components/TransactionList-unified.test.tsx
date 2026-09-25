import { describe, test, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { TransactionList } from "@/components/transactions/TransactionList";
import { listTransactions } from "@/lib/api/transactions-api";
import { getCustodialWallet } from "@/lib/api/wallet-api";
import { useAuthStore } from "@/stores/authStore";
import {
  MOCK_INCOMING_TRANSFER_FIXTURES as IN,
  MOCK_WALLET_TRANSFER_FIXTURES as OUT,
} from "@/lib/api/mock-wallet-transfer-fixtures";
import type { HistoryItem, TransferHistoryItem, User } from "@/types";

// Riwayat terpadu /history (USDX-713, custodial-wallet.md §5.7): tab Semua · Minting ·
// Redeem · Masuk · Keluar, filter di URL, baris transfer masuk/keluar.

const replace = vi.fn();
const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/api/transactions-api", () => ({ listTransactions: vi.fn() }));
vi.mock("@/lib/api/wallet-api", () => ({ getCustodialWallet: vi.fn(), createCustodialWallet: vi.fn() }));
vi.mock("@/lib/api/redeem-api", () => ({ getRedeemOrder: vi.fn() }));

const listMock = vi.mocked(listTransactions);
const CUSTODIAL = "0x000000C528aE908fB929a0898B65e913623c9aFf";

const USER: User = {
  id: "usr_1",
  name: "Demo",
  email: "demo@usdx.com",
  phone: null,
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  custodialWallet: { address: CUSTODIAL, status: "ACTIVE" },
};

const outgoingFailed: TransferHistoryItem = {
  id: OUT.reverted.id,
  type: "TRANSFER_OUT",
  amount: "10.500000",
  amountWei: "10500000",
  chain: "polygon",
  userAddress: CUSTODIAL,
  counterpartyAddress: OUT.reverted.to,
  txHash: OUT.reverted.txHash,
  status: "FAILED",
  failureReason: "REVERTED",
  blockNumber: OUT.reverted.blockNumber,
  createdAt: OUT.reverted.submittedAt,
  updatedAt: OUT.reverted.finalizedAt,
};

function serve(rows: HistoryItem[]) {
  listMock.mockResolvedValue({ data: rows, metadata: { page: 1, limit: 10, total: rows.length } });
}

function renderList() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <LanguageProvider>
        <TransactionList />
      </LanguageProvider>
    </Wrapper>,
  );
}

async function tableRow(text: string) {
  const table = await screen.findByRole("table");
  const found = within(table)
    .getAllByRole("row")
    .find((r) => r.textContent?.includes(text));
  if (!found) throw new Error(`no row for ${text}`);
  return found;
}

beforeEach(() => {
  search = "";
  replace.mockReset();
  push.mockReset();
  listMock.mockReset();
  vi.mocked(getCustodialWallet).mockReset();
  useAuthStore.setState({ user: USER, isAuthenticated: true, token: "t" });
});

describe("TransactionList — unified history", () => {
  describe("positive", () => {
    test("five tabs, and 'Semua' asks for transfers too", async () => {
      serve([]);
      renderList();

      const tabs = await screen.findAllByRole("tab");
      expect(tabs.map((t) => t.textContent)).toEqual([
        "Semua Transaksi",
        "Minting",
        "Redeem",
        "Masuk",
        "Keluar",
      ]);
      expect(screen.getByRole("tab", { name: "Semua Transaksi" })).toHaveAttribute("aria-selected", "true");
      await waitFor(() =>
        expect(listMock).toHaveBeenCalledWith({ page: 1, take: 10, includeTransfers: true }),
      );
    });

    test("the URL filter is read on open: ?type=TRANSFER_IN opens 'Masuk'", async () => {
      search = "type=TRANSFER_IN";
      serve([IN.confirmed]);
      renderList();

      expect(await screen.findByRole("tab", { name: "Masuk" })).toHaveAttribute("aria-selected", "true");
      await waitFor(() => expect(listMock).toHaveBeenCalledWith({ page: 1, take: 10, type: "TRANSFER_IN" }));
    });

    test("picking a tab writes it to the URL and asks the server for that type", async () => {
      serve([]);
      renderList();

      // Radix Tabs activates on mousedown (primary button), not on click.
      fireEvent.mouseDown(await screen.findByRole("tab", { name: "Keluar" }), { button: 0 });
      expect(replace).toHaveBeenLastCalledWith("/history?type=TRANSFER_OUT", { scroll: false });
      await waitFor(() => expect(listMock).toHaveBeenCalledWith({ page: 1, take: 10, type: "TRANSFER_OUT" }));

      fireEvent.mouseDown(screen.getByRole("tab", { name: "Semua Transaksi" }), { button: 0 });
      expect(replace).toHaveBeenLastCalledWith("/history", { scroll: false });
    });

    test("an outgoing row: direction, destination, status + failure sentence, link to the detail", async () => {
      serve([outgoingFailed]);
      renderList();

      const row = await tableRow("Keluar");
      expect(row).toHaveTextContent("Ke 0x5aAeb6...1BeAed");
      expect(row).toHaveTextContent("Gagal");
      expect(row).toHaveTextContent("USDX Anda tidak berpindah. Aman untuk mengirim ulang.");
      expect(within(row).getByRole("link", { name: "Lihat detail" })).toHaveAttribute(
        "href",
        `/send/history/${outgoingFailed.id}`,
      );
    });

    test("an incoming row: sender address only, pending status, row menu, no custodial marker", async () => {
      serve([IN.pending]);
      renderList();

      const row = await tableRow("Masuk");
      expect(row).toHaveTextContent("Dari 0x7c0A3d...3F0E28");
      expect(row).toHaveTextContent("Menunggu konfirmasi");
      expect(within(row).getByRole("button", { name: "Aksi transaksi" })).toBeInTheDocument();
      expect(within(row).queryByRole("link", { name: "Lihat detail" })).toBeNull();
      // userAddress IS the custodial wallet, but transfer rows never get the marker.
      expect(screen.queryByTestId("tx-custodial-marker")).toBeNull();
    });

    // AC: "Klik baris Keluar → halaman detail /send/history/[id]" — the whole row, not only
    // the "Lihat detail" link.
    test("clicking anywhere on an outgoing row opens its detail", async () => {
      serve([outgoingFailed]);
      renderList();

      const row = await tableRow("Keluar");
      fireEvent.click(within(row).getByText("Gagal"));
      expect(push).toHaveBeenCalledWith(`/send/history/${outgoingFailed.id}`);
    });

    test("the mobile card of an outgoing transfer opens its detail", async () => {
      serve([outgoingFailed]);
      renderList();

      const card = await screen.findByTestId("history-transfer-card");
      expect(card).toHaveAttribute("href", `/send/history/${outgoingFailed.id}`);
    });
  });

  describe("negative", () => {
    test("an unknown ?type= falls back to 'Semua'", async () => {
      search = "type=BRIDGE";
      serve([]);
      renderList();

      expect(await screen.findByRole("tab", { name: "Semua Transaksi" })).toHaveAttribute("aria-selected", "true");
      await waitFor(() =>
        expect(listMock).toHaveBeenCalledWith({ page: 1, take: 10, includeTransfers: true }),
      );
    });

    test("an empty 'Masuk' tab is the filter-empty state, not an error", async () => {
      search = "type=TRANSFER_IN";
      serve([]);
      renderList();

      expect(await screen.findByText("Tidak ada yang cocok dengan filter ini")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("edge case", () => {
    test("the copy button inside an outgoing row copies without leaving the page", async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
      serve([outgoingFailed]);
      renderList();

      const row = await tableRow("Keluar");
      fireEvent.click(within(row).getByRole("button", { name: "Salin" }));
      expect(push).not.toHaveBeenCalled();
    });

    test("an incoming row is not a link to anywhere", async () => {
      serve([IN.confirmed]);
      renderList();

      fireEvent.click(within(await tableRow("Masuk")).getByText("Berhasil"));
      expect(push).not.toHaveBeenCalled();
    });

    test("a transfer status the app does not know reads as pending", async () => {
      serve([{ ...IN.confirmed, status: "FINALIZING" }]);
      renderList();

      expect(await tableRow("Masuk")).toHaveTextContent("Menunggu konfirmasi");
    });

    test("the 'Semua' empty state no longer says mint only", async () => {
      serve([]);
      renderList();

      expect(await screen.findByText("Mint, redeem, dan transfer USDX Anda akan muncul di sini.")).toBeInTheDocument();
    });
  });
});
