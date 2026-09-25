// Baris riwayat terpadu `GET /api/v2/transactions` (USDX-713, custodial-wallet.md §5.7,
// common.yaml § HistoryItemType). Satu-satunya tempat FE memutuskan jenis baris.
//
// `HistoryItemType` boleh bertambah di backend yang lebih baru: baris ber-`type` yang
// belum dikenal DILEWATI (tidak dirender, tidak membuat halaman crash) — kontraknya
// "abaikan/sembunyikan baris jenis tak dikenal". Paginasi tetap milik server.

import type { HistoryItem, HistoryItemType, TransferHistoryItem } from "@/types";

export const HISTORY_ITEM_TYPES: readonly HistoryItemType[] = [
  "MINT",
  "REDEEM",
  "TRANSFER_IN",
  "TRANSFER_OUT",
];

export function isHistoryItemType(value: unknown): value is HistoryItemType {
  return typeof value === "string" && (HISTORY_ITEM_TYPES as readonly string[]).includes(value);
}

export function knownHistoryItems(rows: readonly unknown[]): HistoryItem[] {
  return rows.filter(
    (r): r is HistoryItem =>
      typeof r === "object" && r !== null && isHistoryItemType((r as { type?: unknown }).type),
  );
}

export function isTransferItem(item: HistoryItem): item is TransferHistoryItem {
  return item.type === "TRANSFER_IN" || item.type === "TRANSFER_OUT";
}
