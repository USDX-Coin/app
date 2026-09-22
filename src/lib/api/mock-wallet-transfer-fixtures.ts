// ── Fixture riwayat transfer custodial: tiga status + dua alasan gagal (USDX-701) ──
// Bentuk persis contoh wallet.yaml § WalletTransfer. Dipakai unit test
// (`seedMockWalletTransfers`) DAN seam Playwright (`seedWalletTransfers`, localStorage
// yang sama) — karena itu file ini sengaja hanya mengimpor TIPE: suite Playwright
// mengimpornya lewat path relatif tanpa menarik klien API / env Next.

import type { WalletTransfer } from "@/types";

const FIXTURE_BASE = {
  from: "0x000000C528aE908fB929a0898B65e913623c9aFf",
  to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  chain: "polygon",
} as const;

export const MOCK_WALLET_TRANSFER_FIXTURES = {
  pending: {
    ...FIXTURE_BASE,
    id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e04",
    txHash: "0x" + "d4".repeat(32),
    amount: "40.000000",
    amountWei: "40000000",
    status: "PENDING",
    failureReason: null,
    blockNumber: null,
    submittedAt: "2026-08-28T04:40:00.000Z",
    finalizedAt: null,
  },
  confirmed: {
    ...FIXTURE_BASE,
    id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e03",
    txHash: "0x" + "c3".repeat(32),
    amount: "25.000000",
    amountWei: "25000000",
    status: "CONFIRMED",
    failureReason: null,
    blockNumber: 76_543_210,
    submittedAt: "2026-08-28T04:30:00.000Z",
    finalizedAt: "2026-08-28T04:31:30.000Z",
  },
  reverted: {
    ...FIXTURE_BASE,
    id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e02",
    txHash: "0x" + "b2".repeat(32),
    amount: "10.500000",
    amountWei: "10500000",
    status: "FAILED",
    failureReason: "REVERTED",
    blockNumber: 76_543_100,
    submittedAt: "2026-08-28T04:20:00.000Z",
    finalizedAt: "2026-08-28T04:21:40.000Z",
  },
  dropped: {
    ...FIXTURE_BASE,
    id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e01",
    txHash: "0x" + "a1".repeat(32),
    amount: "5.000000",
    amountWei: "5000000",
    status: "FAILED",
    failureReason: "DROPPED",
    blockNumber: null,
    submittedAt: "2026-08-28T04:10:00.000Z",
    finalizedAt: "2026-08-28T04:14:00.000Z",
  },
} satisfies Record<string, WalletTransfer>;

