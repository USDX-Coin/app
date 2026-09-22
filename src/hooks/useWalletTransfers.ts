"use client";

// Riwayat transfer keluar dari wallet custodial (USDX-701). GET
// /api/v2/wallet/transfers (wallet.yaml § transfers) — terbaru dulu, pagination di
// server, jadi halaman memberi page/take dan membaca `metadata` (page/limit/total).
// `keepPreviousData` menjaga daftar tetap terisi selama halaman berikutnya dimuat,
// pola `useTransactions`.

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listWalletTransfers } from "@/lib/api/wallet-api";
import type { ListWalletTransfersParams } from "@/lib/api/types";

export const WALLET_TRANSFERS_KEY = ["wallet-transfers"];

export function useWalletTransfers(params: ListWalletTransfersParams = {}) {
  return useQuery({
    queryKey: [...WALLET_TRANSFERS_KEY, params],
    queryFn: () => listWalletTransfers(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
