"use client";

// Tracker konfirmasi satu transfer custodial (USDX-701). Poll
// GET /api/v2/wallet/transfers/{id} (wallet.yaml § transfer-detail) sampai status
// final — CONFIRMED atau FAILED, keduanya tidak pernah berubah lagi.
//
// - Interval ≥ 3 detik (kontrak: "interval ≥ 3 detik", grup rate limit `wallet`).
// - Berhenti di status final, dan saat layar ditinggal (unmount menghentikan
//   `refetchInterval`; tab tersembunyi juga tidak di-poll — default TanStack).
// - Status tak dikenal dibaca PENDING (`lib/wallet-transfer.ts`) → poll berlanjut.
// - TIDAK ada batas umur: PENDING lama tetap PENDING. Kontrak melarang FE
//   menyimpulkan gagal dari umur transfer; ops sudah dibangunkan alert
//   WALLET_TRANSFER_STUCK.
// - 429 RATE_LIMITED → mundur ke `Retry-After` (tidak pernah di bawah 3 detik);
//   toast throttle ditangani terpusat di Providers.
// - 404 WALLET_TRANSFER_NOT_FOUND (dan 422 VALIDATION_ERROR — id bukan UUID, mis.
//   URL yang salah ketik) → berhenti, tanpa retry: id basi/salah tidak akan muncul
//   karena ditanya lagi. `notFound` menyatukan keduanya; pemanggil menampilkan
//   pesan netral.
//   Galat lain (jaringan, 5xx) tetap di-poll supaya tracker pulih sendiri.
// - Endpoint ini tidak punya 503 (sumbernya DB backend).

import { useQuery } from "@tanstack/react-query";
import { getWalletTransfer } from "@/lib/api/wallet-api";
import {
  getRateLimitSeconds,
  isRateLimited,
  isValidationError,
  isWalletTransferNotFound,
} from "@/lib/api/errors";
import { isFinalTransferStatus, transferStatusOf } from "@/lib/wallet-transfer";

export const TRANSFER_POLL_MS = 3_000;

// Id yang tidak akan pernah menjawab: tidak ada / milik orang lain (404) atau bukan UUID (422).
function isDeadId(error: unknown): boolean {
  return isWalletTransferNotFound(error) || isValidationError(error);
}

function walletTransferKey(id: string | null) {
  return ["wallet-transfer", id];
}

export function useWalletTransferTracker(id: string | null) {
  const query = useQuery({
    queryKey: walletTransferKey(id),
    queryFn: () => getWalletTransfer(id as string),
    enabled: !!id,
    // Status berubah di backend, bukan karena layar ini — jangan sajikan cache basi
    // sebagai status sekarang saat tracker dibuka lagi.
    staleTime: 0,
    retry: (failureCount, error) =>
      !isDeadId(error) && !isRateLimited(error) && failureCount < 1,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && isFinalTransferStatus(transferStatusOf(data))) return false;
      const error = q.state.error;
      if (isDeadId(error)) return false;
      if (isRateLimited(error)) {
        return Math.max(TRANSFER_POLL_MS, (getRateLimitSeconds(error) ?? 0) * 1_000);
      }
      return TRANSFER_POLL_MS;
    },
  });

  const transfer = query.data ?? null;
  const status = transfer ? transferStatusOf(transfer) : null;
  return {
    ...query,
    transfer,
    status,
    notFound: isDeadId(query.error),
  };
}
