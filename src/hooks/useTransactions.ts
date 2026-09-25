"use client";

// Riwayat terpadu /history (USDX-204, USDX-713). GET /api/v2/transactions
// (transactions.yaml § list) via the real-or-mock client: mint + redeem, plus the
// custodial transfers in/out (`type=TRANSFER_*`, or `includeTransfers` for "Semua").
// Pagination + type filter are server-side, so the page passes them in and reads
// `metadata` (page/limit/total) off the paginated envelope. `keepPreviousData` keeps
// the table populated while the next page/filter loads (no flash to skeleton).
//
// Penyegaran (custodial-wallet.md §5.7): selama daftar yang tampil memuat transfer
// PENDING (termasuk status yang belum dikenal — tampil sebagai "Menunggu
// konfirmasi"), daftar disegarkan tiap HISTORY_REFRESH_MS; tanpa PENDING tidak ada
// penyegaran berkala. Tab tersembunyi → berhenti (`refetchIntervalInBackground`
// bawaan TanStack = false). 429 RATE_LIMITED → mundur ke `Retry-After` lalu coba
// lagi (≤ RATE_LIMIT_RETRIES), dan penyegaran berikutnya menunggu paling tidak
// selama itu juga.

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/transactions-api";
import { getRateLimitSeconds, isRateLimited } from "@/lib/api/errors";
import { hasPendingTransfer } from "@/lib/history-item";
import type { ListTransactionsParams } from "@/lib/api/types";

// Diinvalidasi useTransfer (sesudah broadcast) dan useWalletTransferTracker (saat
// final), supaya riwayat tidak pernah tertinggal dari transfer yang baru dikirim.
export const TRANSACTIONS_KEY = ["transactions"];
export const HISTORY_REFRESH_MS = 15_000;
export const RATE_LIMIT_RETRIES = 2;

export function useTransactions(params: ListTransactionsParams = {}) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, params],
    queryFn: () => listTransactions(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: (failureCount, error) =>
      isRateLimited(error) ? failureCount < RATE_LIMIT_RETRIES : failureCount < 1,
    retryDelay: (attempt, error) =>
      isRateLimited(error)
        ? Math.max(1, getRateLimitSeconds(error) ?? 1) * 1_000
        : Math.min(1_000 * 2 ** attempt, 30_000),
    refetchInterval: (query) => {
      if (!hasPendingTransfer(query.state.data?.data ?? [])) return false;
      const error = query.state.error;
      const wait = isRateLimited(error) ? (getRateLimitSeconds(error) ?? 0) * 1_000 : 0;
      return Math.max(HISTORY_REFRESH_MS, wait);
    },
  });
}
