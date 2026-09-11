"use client";

// Wallet custodial milik user yang login (wallet.yaml, USDX-567). Satu hook
// untuk tiga layar yang bercabang padanya — tujuan mint "wallet custodial saya",
// sumber redeem custodial, dan halaman transfer:
//
//   1. ADA / TIDAK ADA dibaca dari `user.custodialWallet` di profil (users.yaml
//      § User, USDX-607) — ringkasan address + status yang ikut /auth/me. User
//      non-custodial (mayoritas) tidak pernah memicu `GET /api/v2/wallet` dan
//      tidak menelan 404 di tiap cold start.
//   2. SALDO dibaca dari `GET /api/v2/wallet` hanya kalau ringkasan itu ada.
//      Saldo di sana dibaca live dari chain oleh backend; `null` = tidak terbaca
//      (RPC mati / masih PROVISIONING) dan WAJIB dirender "—", bukan 0 — angka
//      nol palsu terbaca user sebagai dana hilang (USDX-396 untuk wallet
//      eksternal, aturan yang sama di sini).
//
// Status dari salinan kerja backend adalah UX, bukan penegakan: wallet-service
// memeriksa ulang saat permintaan sign masuk. Hook ini memberi jawaban cepat yang
// benar di kasus normal; 409 WALLET_NOT_ACTIVE dari backend tetap ditangani
// pemanggil.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getCustodialWallet } from "@/lib/api/wallet-api";
import type { CustodialWallet, CustodialWalletStatus, CustodialWalletSummary } from "@/types";

export const CUSTODIAL_WALLET_KEY = ["custodial-wallet"];

export type CustodialBalanceState = "none" | "loading" | "unavailable" | "ready";

export interface CustodialWalletRead {
  /** User punya wallet custodial (apa pun statusnya). */
  hasWallet: boolean;
  summary: CustodialWalletSummary | null;
  /** Detail dari GET /api/v2/wallet — null sebelum dimuat / tanpa wallet. */
  wallet: CustodialWallet | null;
  address: string | null;
  status: CustodialWalletStatus | null;
  /** ACTIVE + address terisi — satu-satunya keadaan yang boleh bertransaksi. */
  isActive: boolean;
  /** Saldo USDX; non-null HANYA saat `balanceState === "ready"`. Nol adalah nilai sah. */
  balanceUsdx: number | null;
  balanceState: CustodialBalanceState;
  /** `false` = akun belum punya PIN (→ arahkan buat PIN). `null` = tidak diketahui. */
  pinSet: boolean | null;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  /** Tandai saldo basi (setelah transfer/redeem) — refetch di latar. */
  invalidate: () => void;
}

// Decimal string dari API → angka finite, atau null. `""`/null tidak boleh jadi 0.
function toNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function useCustodialWallet(): CustodialWalletRead {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const summary = user?.custodialWallet ?? null;
  const hasSummary = summary !== null;

  const query = useQuery({
    queryKey: CUSTODIAL_WALLET_KEY,
    queryFn: getCustodialWallet,
    enabled: hasSummary,
    staleTime: 15_000,
    retry: 1,
  });

  const wallet = query.data ?? null;
  // Detail lebih segar dari ringkasan yang di-persist; kalau GET menjawab "tidak
  // ada" (null) sementara ringkasan bilang ada, ringkasan yang basi.
  const hasWallet = hasSummary && !(query.isSuccess && wallet === null);
  const status = wallet?.status ?? (hasWallet ? summary?.status ?? null : null);
  const address = wallet?.address ?? (hasWallet ? summary?.address ?? null : null);
  const isActive = hasWallet && status === "ACTIVE" && !!address;

  const balanceUsdx = isActive ? toNumber(wallet?.balance) : null;
  const balanceState: CustodialBalanceState = !hasWallet
    ? "none"
    : query.isLoading
      ? "loading"
      : balanceUsdx == null
        ? "unavailable"
        : "ready";

  return {
    hasWallet,
    summary: hasWallet ? summary : null,
    wallet,
    address,
    status,
    isActive,
    balanceUsdx: balanceState === "ready" ? balanceUsdx : null,
    balanceState,
    pinSet: typeof user?.pinSet === "boolean" ? user.pinSet : null,
    isLoading: hasSummary && query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTODIAL_WALLET_KEY });
    },
  };
}
