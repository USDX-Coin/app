import { describe, test, expect } from "vitest";
import {
  hasPendingTransfer,
  isHistoryItemType,
  isTransferItem,
  knownHistoryItems,
} from "@/lib/history-item";
import { MOCK_INCOMING_TRANSFER_FIXTURES as IN } from "@/lib/api/mock-wallet-transfer-fixtures";
import type { ConsumerTransaction, HistoryItem } from "@/types";

// Jenis baris riwayat terpadu (common.yaml § HistoryItemType, USDX-713).
const mint = { id: "m1", type: "MINT" } as ConsumerTransaction;

describe("history-item", () => {
  describe("positive", () => {
    test("the four known types", () => {
      for (const t of ["MINT", "REDEEM", "TRANSFER_IN", "TRANSFER_OUT"]) expect(isHistoryItemType(t)).toBe(true);
    });

    test("transfer rows are told apart from orders", () => {
      expect(isTransferItem(IN.pending)).toBe(true);
      expect(isTransferItem({ ...IN.pending, type: "TRANSFER_OUT" })).toBe(true);
      expect(isTransferItem(mint)).toBe(false);
    });

    test("a PENDING transfer on the page asks for a refresh", () => {
      expect(hasPendingTransfer([mint, IN.pending])).toBe(true);
    });
  });

  describe("negative", () => {
    test("confirmed/failed transfers and orders do not", () => {
      const rows: HistoryItem[] = [mint, IN.confirmed, { ...IN.confirmed, status: "FAILED" }];
      expect(hasPendingTransfer(rows)).toBe(false);
    });

    test("unknown or missing types are dropped, never rendered", () => {
      expect(knownHistoryItems([mint, { id: "x", type: "BRIDGE" }, { id: "y" }, null, "z"])).toEqual([mint]);
      expect(isHistoryItemType("mint")).toBe(false);
      expect(isHistoryItemType(null)).toBe(false);
    });
  });

  describe("edge case", () => {
    test("a transfer status the app does not know counts as pending", () => {
      expect(hasPendingTransfer([{ ...IN.confirmed, status: "FINALIZING" }])).toBe(true);
    });
  });
});
