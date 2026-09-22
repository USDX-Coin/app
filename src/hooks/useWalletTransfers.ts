"use client";

// Riwayat transfer keluar dari wallet custodial (USDX-701). GET
// /api/v2/wallet/transfers (wallet.yaml § transfers) — terbaru dulu, pagination di
// server, jadi halaman memberi page/take dan membaca `metadata` (page/limit/total).
// `keepPreviousData` menjaga daftar tetap terisi selama halaman berikutnya dimuat,
// pola `useTransactions`.
//
// 429 RATE_LIMITED (grup `wallet`) → mundur ke `Retry-After` lalu coba lagi, paling
// banyak RATE_LIMIT_RETRIES kali (tiket: "429 → backoff"). Menunggu selama yang
// diminta server bukan menumpuk ke throttle — itu yang dilarang default Providers.
// Baru sesudah itu daftar menyerah ke error-state (bukan empty-state).

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listWalletTransfers } from "@/lib/api/wallet-api";
import { getRateLimitSeconds, isRateLimited } from "@/lib/api/errors";
import type { ListWalletTransfersParams } from "@/lib/api/types";

// Diinvalidasi useTransfer (sesudah broadcast) dan useWalletTransferTracker (saat final),
// supaya daftar tidak pernah tertinggal dari transfer yang baru dikirim (review app#79).
export const WALLET_TRANSFERS_KEY = ["wallet-transfers"];
export const RATE_LIMIT_RETRIES = 2;

export function useWalletTransfers(params: ListWalletTransfersParams = {}) {
  return useQuery({
    queryKey: [...WALLET_TRANSFERS_KEY, params],
    queryFn: () => listWalletTransfers(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: (failureCount, error) =>
      isRateLimited(error) ? failureCount < RATE_LIMIT_RETRIES : failureCount < 1,
    retryDelay: (attempt, error) =>
      isRateLimited(error)
        ? Math.max(1, getRateLimitSeconds(error) ?? 1) * 1_000
        : Math.min(1_000 * 2 ** attempt, 30_000),
  });
}
