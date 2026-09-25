// ── Mock USDX MASUK ke wallet custodial (riwayat terpadu, USDX-713) ───────────
// Stand-in untuk tabel `wallet_incoming_transfers` yang diisi job pemindai event
// `Transfer` backend (custodial-wallet.md §5.7, USDX-711). Disimpan di localStorage
// ("usdx-mock-incoming-transfers") supaya bertahan melintasi `page.goto` Playwright.
//
// "Lintasan final" diperankan saat BACA: baris PENDING yang `settleAt`-nya lewat
// menjadi CONFIRMED. `settleAt: null` = tetap seperti diseed. TRANSFER_IN tidak
// pernah FAILED (korban reorg dihapus, bukan diberi status).
//
// Fixture ada di mock-wallet-transfer-fixtures.ts (hanya tipe, supaya suite
// Playwright bisa mengimpornya).

import type { TransferHistoryItem } from "@/types";

const LEDGER_KEY = "usdx-mock-incoming-transfers";

interface MockIncomingRow extends TransferHistoryItem {
  userId: string;
  // Epoch ms saat baris PENDING dikonfirmasi. Null = tidak berubah.
  settleAt: number | null;
}

let ledgerMemory: MockIncomingRow[] = [];

function readLedger(): MockIncomingRow[] {
  if (typeof localStorage === "undefined") return ledgerMemory;
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return raw ? (JSON.parse(raw) as MockIncomingRow[]) : [];
  } catch {
    return [];
  }
}

function writeLedger(rows: MockIncomingRow[]) {
  ledgerMemory = rows;
  if (typeof localStorage === "undefined") return;
  if (rows.length === 0) localStorage.removeItem(LEDGER_KEY);
  else localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
}

function settleRow(row: MockIncomingRow, now: number): MockIncomingRow {
  if (row.status !== "PENDING" || row.settleAt === null || now < row.settleAt) return row;
  return { ...row, status: "CONFIRMED", updatedAt: new Date(row.settleAt).toISOString(), settleAt: null };
}

// Baris masuk milik `userId`, bentuk wire saja (field mock-only tidak bocor).
export function listMockIncomingTransfers(userId: string): TransferHistoryItem[] {
  const now = Date.now();
  const rows = readLedger();
  const next = rows.map((r) => settleRow(r, now));
  if (next.some((r, i) => r !== rows[i])) writeLedger(next);
  return next
    .filter((r) => r.userId === userId)
    .map(({ userId: _userId, settleAt: _settleAt, ...item }) => item);
}

// Unit test: pasang baris jadi (menimpa seluruh buku besar).
export function seedMockIncomingTransfers(
  rows: (TransferHistoryItem & { settleAt?: number | null })[],
  userId = "usr_1",
): void {
  writeLedger(rows.map((r) => ({ settleAt: null, ...r, userId })));
}
