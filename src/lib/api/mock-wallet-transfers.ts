// ── Mock riwayat & status transfer custodial (wallet.yaml, USDX-701) ─────────
// Stand-in untuk `GET /api/v2/wallet/transfers` (+ `/{id}`). Buku besar transfer
// yang sudah di-broadcast (padanan baris `DONE` `wallet_transfer_requests`),
// disimpan di localStorage ("usdx-mock-wallet-transfers") supaya bertahan
// melintasi `page.goto` Playwright: /send → tracker → /send/history → detail
// menempuh beberapa muatan halaman.
//
// Watcher receipt backend diperankan saat BACA: baris PENDING yang `settleAt`-nya
// lewat berpindah ke `outcome`-nya. `outcome` = "CONFIRMED" | "REVERTED" |
// "DROPPED" | "PENDING" (macet selamanya — umur tidak pernah membuat gagal) | nilai
// status lain apa pun (memerankan enum yang bertambah di backend baru; FE wajib
// membacanya seperti PENDING).
//
// Arah impor satu jalur: mock-custodial-wallet.ts → file ini (pemilik sesi user,
// throttle, dan sumber transfer baru ada di sana). File ini tidak mengimpor balik.
// Fixture tiga status ada di mock-wallet-transfer-fixtures.ts (hanya tipe, supaya
// suite Playwright bisa mengimpornya).

import type { TransferAccepted, TransferHistoryItem, WalletTransfer } from "@/types";
import type { Paginated } from "./client";
import { ApiError } from "./client";

const LEDGER_KEY = "usdx-mock-wallet-transfers";

// Jeda "watcher" memutuskan status final transfer baru. Di atas satu interval
// poll tracker (3 s) supaya layar sempat menampilkan "menunggu konfirmasi" dulu.
export const MOCK_TRANSFER_CONFIRM_MS = 3_500;

export type MockTransferOutcome =
  | "CONFIRMED"
  | "REVERTED"
  | "DROPPED"
  | "PENDING"
  | (string & {});

interface MockTransferRow extends WalletTransfer {
  userId: string;
  // Epoch ms saat "watcher" memutuskan `outcome`. Null = sudah final / tak berubah.
  settleAt: number | null;
  outcome: MockTransferOutcome;
}

let ledgerMemory: MockTransferRow[] = [];

function readLedger(): MockTransferRow[] {
  if (typeof localStorage === "undefined") return ledgerMemory;
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return raw ? (JSON.parse(raw) as MockTransferRow[]) : [];
  } catch {
    return [];
  }
}

function writeLedger(rows: MockTransferRow[]) {
  ledgerMemory = rows;
  if (typeof localStorage === "undefined") return;
  if (rows.length === 0) localStorage.removeItem(LEDGER_KEY);
  else localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
}

export function resetMockWalletTransfers() {
  writeLedger([]);
}

// Keputusan watcher untuk satu baris, bila waktunya sudah tiba.
function settleRow(row: MockTransferRow, now: number): MockTransferRow {
  if (row.status !== "PENDING" || row.settleAt === null || now < row.settleAt) return row;
  const finalizedAt = new Date(row.settleAt).toISOString();
  switch (row.outcome) {
    case "PENDING":
      return { ...row, settleAt: null };
    case "CONFIRMED":
      return { ...row, status: "CONFIRMED", blockNumber: row.blockNumber ?? 76_543_210, finalizedAt, settleAt: null };
    case "REVERTED":
      return {
        ...row,
        status: "FAILED",
        failureReason: "REVERTED",
        blockNumber: row.blockNumber ?? 76_543_210,
        finalizedAt,
        settleAt: null,
      };
    case "DROPPED":
      return { ...row, status: "FAILED", failureReason: "DROPPED", blockNumber: null, finalizedAt, settleAt: null };
    default:
      // Status yang belum dikenal FE — tidak final dari sudut pandang FE.
      return { ...row, status: row.outcome, settleAt: null };
  }
}

function settledLedger(): MockTransferRow[] {
  const now = Date.now();
  const rows = readLedger();
  const next = rows.map((r) => settleRow(r, now));
  if (next.some((r, i) => r !== rows[i])) writeLedger(next);
  return next;
}

// Bentuk wire saja — field mock-only (`userId`, `settleAt`, `outcome`) tidak bocor.
function toWalletTransfer(r: MockTransferRow): WalletTransfer {
  return {
    id: r.id,
    txHash: r.txHash,
    from: r.from,
    to: r.to,
    amount: r.amount,
    amountWei: r.amountWei,
    chain: r.chain,
    status: r.status,
    failureReason: r.failureReason,
    blockNumber: r.blockNumber,
    submittedAt: r.submittedAt,
    finalizedAt: r.finalizedAt,
  };
}

// Transfer yang baru di-broadcast (dipanggil mockTransferCustodial) → baris PENDING.
export function recordMockWalletTransfer(
  accepted: TransferAccepted,
  userId: string,
  outcome: MockTransferOutcome = "CONFIRMED",
): void {
  const row: MockTransferRow = {
    ...accepted,
    status: "PENDING",
    failureReason: null,
    blockNumber: null,
    finalizedAt: null,
    userId,
    settleAt: Date.parse(accepted.submittedAt) + MOCK_TRANSFER_CONFIRM_MS,
    outcome,
  };
  writeLedger([...readLedger(), row]);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Terbaru dulu: `submittedAt` desc, pemecah seri `id` desc (wallet.yaml § transfers).
function newestFirst(a: MockTransferRow, b: MockTransferRow): number {
  if (a.submittedAt !== b.submittedAt) return a.submittedAt < b.submittedAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function listMockWalletTransfers(
  userId: string,
  params: { page?: number; take?: number },
): Paginated<WalletTransfer> {
  const page = params.page ?? 1;
  const take = params.take ?? 10;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(take) || take < 1 || take > 50) {
    throw new ApiError(422, "VALIDATION_ERROR", "Parameter halaman tidak valid");
  }
  // Tanpa wallet / tanpa transfer → 200 daftar kosong, bukan 404.
  const mine = settledLedger().filter((r) => r.userId === userId).sort(newestFirst);
  const start = (page - 1) * take;
  return {
    data: mine.slice(start, start + take).map(toWalletTransfer),
    metadata: { page, limit: take, total: mine.length },
  };
}

// Baris TRANSFER_OUT riwayat terpadu `GET /api/v2/transactions` (USDX-713): baris
// buku besar yang sama, bentuk transactions.yaml § TransferHistoryItem — `createdAt`
// = `submittedAt` (kunci urutan), pihak lain = tujuan.
export function listMockTransferOutHistory(userId: string): TransferHistoryItem[] {
  return settledLedger()
    .filter((r) => r.userId === userId)
    .map((r) => ({
      id: r.id,
      type: "TRANSFER_OUT",
      amount: r.amount,
      amountWei: r.amountWei,
      chain: r.chain,
      userAddress: r.from,
      counterpartyAddress: r.to,
      txHash: r.txHash,
      status: r.status,
      failureReason: r.failureReason,
      blockNumber: r.blockNumber,
      createdAt: r.submittedAt,
      updatedAt: r.finalizedAt ?? r.submittedAt,
    }));
}

export function getMockWalletTransfer(userId: string, id: string): WalletTransfer {
  if (!UUID_REGEX.test(id)) {
    throw new ApiError(422, "VALIDATION_ERROR", "id harus UUID");
  }
  // Milik user lain dijawab sama persis dengan yang tidak ada.
  const row = settledLedger().find((r) => r.id === id && r.userId === userId);
  if (!row) throw new ApiError(404, "WALLET_TRANSFER_NOT_FOUND", "Transfer tidak ditemukan");
  return toWalletTransfer(row);
}

// Unit test: pasang baris jadi (tanpa perpindahan status kecuali `settleAt` diisi).
export function seedMockWalletTransfers(
  rows: (WalletTransfer & Partial<Pick<MockTransferRow, "userId" | "settleAt" | "outcome">>)[],
  userId = "usr_1",
): void {
  writeLedger(
    rows.map((r) => ({
      settleAt: null,
      outcome: r.status,
      ...r,
      userId: r.userId ?? userId,
    })),
  );
}
