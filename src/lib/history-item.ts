// Baris riwayat terpadu `GET /api/v2/transactions` (USDX-713, custodial-wallet.md §5.7,
// common.yaml § HistoryItemType). Satu-satunya tempat FE memutuskan jenis baris.
//
// `HistoryItemType` boleh bertambah di backend yang lebih baru: baris ber-`type` yang
// belum dikenal DILEWATI (tidak dirender, tidak membuat halaman crash) — kontraknya
// "abaikan/sembunyikan baris jenis tak dikenal". Paginasi tetap milik server.

import { transferStatusOf } from "@/lib/wallet-transfer";
import type { HistoryItem, HistoryItemType, TransferHistoryItem } from "@/types";

const HISTORY_ITEM_TYPES: readonly HistoryItemType[] = [
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

// Ada baris transfer yang masih "Menunggu konfirmasi" (status tak dikenal ikut —
// ditampilkan sebagai PENDING oleh `transferStatusOf`)? Pemicu penyegaran /history.
export function hasPendingTransfer(rows: readonly HistoryItem[]): boolean {
  return rows.some((r) => isTransferItem(r) && transferStatusOf(r) === "PENDING");
}

// Riwayat transfer keluar = /history tab Keluar (§5.7). Tujuan tautan balik tracker,
// detail, dan redirect route lama /send/history.
export const OUTGOING_HISTORY_HREF = "/history?type=TRANSFER_OUT";
