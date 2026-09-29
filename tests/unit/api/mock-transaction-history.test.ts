import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mockListConsumerTransactions } from "@/lib/api/mock-api";
import { resetMockCustodialWallet } from "@/lib/api/mock-custodial-wallet";
import { seedMockWalletTransfers } from "@/lib/api/mock-wallet-transfers";
import { seedMockIncomingTransfers } from "@/lib/api/mock-incoming-transfers";
import {
  MOCK_INCOMING_TRANSFER_FIXTURES as IN,
  MOCK_WALLET_TRANSFER_FIXTURES as OUT,
} from "@/lib/api/mock-wallet-transfer-fixtures";
import type { HistoryItem, TransferHistoryItem } from "@/types";

// Mock riwayat terpadu `GET /api/v2/transactions` (USDX-713, transactions.yaml § list,
// custodial-wallet.md §5.7): satu-satunya backend yang dilihat suite Playwright
// offline, jadi aturan jenis per parameter, urutan dan bentuk baris transfer harus
// sama dengan kontrak.

const transfers = (rows: HistoryItem[]) =>
  rows.filter((r): r is TransferHistoryItem => r.type === "TRANSFER_IN" || r.type === "TRANSFER_OUT");

beforeEach(() => {
  resetMockCustodialWallet();
  seedMockWalletTransfers([OUT.confirmed, OUT.reverted]);
  seedMockIncomingTransfers([IN.confirmed, IN.pending]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mockListConsumerTransactions — riwayat terpadu", () => {
  describe("positive", () => {
    test("includeTransfers=true merges mint, redeem, incoming and outgoing rows", async () => {
      const page = await mockListConsumerTransactions({ page: 1, take: 100, includeTransfers: true });
      const types = new Set(page.data.map((r) => r.type));
      expect(types).toEqual(new Set(["MINT", "REDEEM", "TRANSFER_IN", "TRANSFER_OUT"]));
      expect(page.metadata.total).toBe(page.data.length);
    });

    test("type=TRANSFER_IN returns only incoming rows, newest first", async () => {
      const page = await mockListConsumerTransactions({ type: "TRANSFER_IN" });
      expect(page.data.map((r) => r.id)).toEqual([IN.pending.id, IN.confirmed.id]);
      expect(page.metadata.total).toBe(2);
    });

    test("type=TRANSFER_OUT maps the transfer ledger to TransferHistoryItem", async () => {
      const page = await mockListConsumerTransactions({ type: "TRANSFER_OUT" });
      expect(page.data.map((r) => r.id)).toEqual([OUT.confirmed.id, OUT.reverted.id]);
      const [confirmed, reverted] = transfers(page.data);
      expect(confirmed).toEqual({
        id: OUT.confirmed.id,
        type: "TRANSFER_OUT",
        amount: OUT.confirmed.amount,
        amountWei: OUT.confirmed.amountWei,
        chain: "polygon",
        userAddress: OUT.confirmed.from,
        counterpartyAddress: OUT.confirmed.to,
        txHash: OUT.confirmed.txHash,
        status: "CONFIRMED",
        failureReason: null,
        blockNumber: OUT.confirmed.blockNumber,
        createdAt: OUT.confirmed.submittedAt,
        updatedAt: OUT.confirmed.finalizedAt,
      });
      expect(reverted).toMatchObject({ status: "FAILED", failureReason: "REVERTED" });
    });

    test("an incoming PENDING row turns CONFIRMED once the mock chain confirms it", async () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
      vi.setSystemTime(new Date("2026-08-28T05:00:00.000Z"));
      seedMockIncomingTransfers([{ ...IN.pending, settleAt: Date.now() + 5_000 }]);

      const before = mockListConsumerTransactions({ type: "TRANSFER_IN" });
      await vi.advanceTimersByTimeAsync(300);
      expect(transfers((await before).data)[0].status).toBe("PENDING");

      vi.setSystemTime(Date.now() + 5_000);
      const after = mockListConsumerTransactions({ type: "TRANSFER_IN" });
      await vi.advanceTimersByTimeAsync(300);
      expect(transfers((await after).data)[0].status).toBe("CONFIRMED");
    });
  });

  describe("negative", () => {
    test("without type and includeTransfers: mint + redeem only (old clients)", async () => {
      const page = await mockListConsumerTransactions({ page: 1, take: 100 });
      expect(transfers(page.data)).toEqual([]);
    });

    test("a type filter ignores includeTransfers", async () => {
      const page = await mockListConsumerTransactions({ type: "MINT", includeTransfers: true, take: 100 });
      expect(page.data.every((r) => r.type === "MINT")).toBe(true);
    });

    test("transfers of another account never show", async () => {
      seedMockWalletTransfers([OUT.confirmed], "usr_other");
      seedMockIncomingTransfers([IN.confirmed], "usr_other");
      const page = await mockListConsumerTransactions({ includeTransfers: true, take: 100 });
      expect(transfers(page.data)).toEqual([]);
    });
  });

  describe("edge case", () => {
    test("an account without a custodial wallet: transfer tabs are empty, not an error", async () => {
      seedMockWalletTransfers([]);
      seedMockIncomingTransfers([]);
      const incoming = await mockListConsumerTransactions({ type: "TRANSFER_IN" });
      const outgoing = await mockListConsumerTransactions({ type: "TRANSFER_OUT" });
      expect(incoming).toEqual({ data: [], metadata: { page: 1, limit: 10, total: 0 } });
      expect(outgoing.data).toEqual([]);
    });

    test("ties on createdAt break by id desc", async () => {
      seedMockWalletTransfers([]);
      const at = "2026-08-28T04:00:00.000Z";
      seedMockIncomingTransfers([
        { ...IN.confirmed, id: "0193abcf-0000-7000-8000-000000000001", createdAt: at },
        { ...IN.confirmed, id: "0193abcf-0000-7000-8000-000000000002", createdAt: at },
      ]);
      const page = await mockListConsumerTransactions({ type: "TRANSFER_IN" });
      expect(page.data.map((r) => r.id.slice(-1))).toEqual(["2", "1"]);
    });
  });
});
