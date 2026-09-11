"use client";

// Wallet custodial user — satu hook untuk onboarding, Pengaturan, dan kartu
// saldo sidebar (USDX-566; wallet.yaml, custodial-wallet.md §5.5).
//
// Tiga aturan kontrak yang ditegakkan DI SINI, bukan di komponen:
//
// 1. **Routing dibaca dari `user.custodialWallet`** (`/auth/me`, pola `pinSet`).
//    `GET /api/v2/wallet` hanya dipanggil kalau profil bilang user punya wallet —
//    bukan dipanggil lalu menelan 404 di setiap cold start user non-custodial.
//    Satu-satunya pengecualian: `POST` dijawab 409 (wallet ada tapi salinan di
//    profil basi) — saat itu GET adalah satu-satunya yang tahu bentuk aslinya.
//
// 2. **Poll dibatasi.** Provisioning yang gagal TIDAK punya keadaan terminal di
//    gelombang 1 (enum hanya PROVISIONING | ACTIVE | SUSPENDED): baris tetap
//    PROVISIONING dan wallet-service yang retry. Jadi hook-lah yang menjaga user
//    tidak menunggu selamanya — poll berhenti setelah `pollBudgetMs`, lalu UI
//    menampilkan "masih disiapkan" + tombol coba lagi. Coba lagi = `POST` ulang
//    (aman: masih PROVISIONING → 202, bukan error), dan itu bukan sekadar
//    penghalus UX: respons POST-lah yang menyegarkan salinan kerja backend
//    (§5.5), jadi tombol itu jalur penyembuh yang sesungguhnya.
//
// 3. **`balance` null ≠ nol.** RPC tak terjangkau → ketiga field saldo null.
//    `balanceUsdx` hanya berisi angka kalau backend memberi angka; komponen
//    merender "—"/skeleton untuk null dan tidak pernah jatuh ke 0.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { createCustodialWallet, getCustodialWallet } from "@/lib/api/wallet-api";
import { isWalletAlreadyExists, isWalletSuspended } from "@/lib/api/errors";
import { env } from "@/lib/env";
import type { CustodialWallet, CustodialWalletStatus, CustodialWalletSummary } from "@/types";

export const CUSTODIAL_WALLET_KEY = ["wallet", "me"] as const;
// Provisioning di lab selesai dalam hitungan detik (Vault → YAML → /reload →
// eth_accounts). 3 detik × 20 = satu menit sebelum layar menyerah dan menawarkan
// coba lagi — cukup lama untuk reload Web3Signer yang menumpuk, cukup pendek
// untuk tidak terasa seperti spinner tanpa batas.
export const CUSTODIAL_POLL_INTERVAL_MS = 3_000;
export const CUSTODIAL_POLL_BUDGET_MS = 60_000;

// Test seam (pola `usdx-mock-banner-ttl`): Playwright memendekkan jendela poll
// supaya keadaan "masih disiapkan" bisa diuji tanpa menunggu satu menit. Hanya
// dibaca di mode mock — backend sungguhan tidak pernah melihat ini.
function resolvePollBudgetMs(): number {
  if (!env.useMock || typeof localStorage === "undefined") return CUSTODIAL_POLL_BUDGET_MS;
  const raw = localStorage.getItem("usdx-mock-custodial-poll-budget");
  if (raw === null) return CUSTODIAL_POLL_BUDGET_MS;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : CUSTODIAL_POLL_BUDGET_MS;
}

/** "none" = user tidak punya wallet custodial (mayoritas non-custodial). */
export type CustodialWalletView = "none" | CustodialWalletStatus;

/** Saldo untuk layar transaksi (USDX-567): "none" tanpa wallet, "ready" hanya saat angka ada. */
export type CustodialBalanceState = "none" | "loading" | "unavailable" | "ready";

export interface CustodialWalletState {
  /** Ringkasan dari `/auth/me` — yang menentukan routing. */
  summary: CustodialWalletSummary | null;
  status: CustodialWalletView;
  // ── Turunan untuk layar transaksi (transfer / tujuan mint / sumber redeem, USDX-567) ──
  /** User punya wallet custodial, apa pun statusnya. */
  hasWallet: boolean;
  /** Address dari GET (lebih segar) atau ringkasan profil; null selama PROVISIONING / tanpa wallet. */
  address: string | null;
  /** ACTIVE + address terisi — satu-satunya keadaan yang boleh bertransaksi. */
  isActive: boolean;
  /** "ready" hanya kalau `balanceUsdx` non-null; null tidak pernah dirender 0. */
  balanceState: CustodialBalanceState;
  /** `false` = akun belum punya PIN (users.yaml `pinSet`); `null` = tidak diketahui. */
  pinSet: boolean | null;
  /** Tandai wallet basi (setelah transfer/redeem, atau 409 WALLET_NOT_ACTIVE) — refetch di latar. */
  invalidate: () => void;
  /** Bentuk penuh dari `GET /api/v2/wallet`; null sebelum dibaca / tanpa wallet. */
  wallet: CustodialWallet | null;
  /** Saldo USDX. Non-null HANYA kalau backend memberi angka — null bukan nol. */
  balanceUsdx: number | null;
  balanceAt: string | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  /** `POST /api/v2/wallet` — buat, atau coba lagi saat masih PROVISIONING. */
  create: () => Promise<void>;
  createPending: boolean;
  createError: unknown;
  /** Poll sedang berjalan (PROVISIONING, di dalam jendela). */
  isPolling: boolean;
  /** PROVISIONING melewati jendela poll → tampilkan "masih disiapkan" + coba lagi. */
  provisioningTimedOut: boolean;
}

export interface UseCustodialWalletOptions {
  /** Poll `GET` selama PROVISIONING. Nyalakan di layar yang menunggu (onboarding, Pengaturan); matikan di sidebar. */
  poll?: boolean;
  /** Override jendela poll (unit test). Default: konstanta / seam mock. */
  pollBudgetMs?: number;
}

function summaryOf(wallet: CustodialWallet): CustodialWalletSummary {
  return { address: wallet.address, status: wallet.status };
}

function sameSummary(a: CustodialWalletSummary | null | undefined, b: CustodialWalletSummary): boolean {
  return a?.status === b.status && a?.address === b.address;
}

export function useCustodialWallet({
  poll = false,
  pollBudgetMs,
}: UseCustodialWalletOptions = {}): CustodialWalletState {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const summary = user?.custodialWallet ?? null;

  // Dinyalakan setelah POST dijawab 409: wallet ada tapi profil tidak tahu
  // bentuknya. Ini satu-satunya jalan GET dipanggil untuk user yang profilnya
  // bilang "tidak punya".
  const [forceRead, setForceRead] = useState(false);
  const enabled = isAuthenticated && (summary !== null || forceRead);

  // Jendela poll dimulai saat layar dibuka (wallet sudah PROVISIONING dari
  // sesi sebelumnya) atau saat POST berhasil; `exhausted` = jendela habis.
  const [pollStartedAt, setPollStartedAt] = useState<number>(() => Date.now());
  const [exhausted, setExhausted] = useState(false);

  const query = useQuery({
    queryKey: CUSTODIAL_WALLET_KEY,
    queryFn: getCustodialWallet,
    enabled,
    staleTime: 15_000,
    retry: false,
    refetchInterval: (q) =>
      poll && !exhausted && q.state.data?.status === "PROVISIONING"
        ? CUSTODIAL_POLL_INTERVAL_MS
        : false,
  });

  const wallet = query.data ?? null;
  // `undefined` = belum dibaca → percaya profil; `null` = backend bilang tidak ada.
  const status: CustodialWalletView =
    query.data !== undefined ? (query.data?.status ?? "none") : (summary?.status ?? "none");
  const isPolling = poll && !exhausted && status === "PROVISIONING";

  // Jendela poll: satu timer per (mulai, sedang-poll). setState di dalam
  // callback timer, bukan di badan effect.
  useEffect(() => {
    if (!isPolling) return;
    const budget = pollBudgetMs ?? resolvePollBudgetMs();
    const remaining = pollStartedAt + budget - Date.now();
    const timer = setTimeout(() => setExhausted(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [isPolling, pollStartedAt, pollBudgetMs]);

  // Salinan di profil mengikuti hasil GET, supaya sidebar/routing di layar lain
  // melihat ACTIVE (dan address) tanpa menunggu refresh /auth/me berikutnya.
  useEffect(() => {
    if (query.data === undefined || !user) return;
    if (query.data === null) {
      if (user.custodialWallet) setUser({ ...user, custodialWallet: null });
      return;
    }
    const next = summaryOf(query.data);
    if (!sameSummary(user.custodialWallet, next)) setUser({ ...user, custodialWallet: next });
  }, [query.data, user, setUser]);

  const createMutation = useMutation({
    mutationFn: createCustodialWallet,
    onSuccess: (data) => {
      queryClient.setQueryData(CUSTODIAL_WALLET_KEY, data);
      const current = useAuthStore.getState().user;
      if (current) setUser({ ...current, custodialWallet: summaryOf(data) });
      // Jendela poll baru — juga untuk "coba lagi" setelah jendela lama habis.
      setPollStartedAt(Date.now());
      setExhausted(false);
    },
    onError: (err) => {
      if (isWalletAlreadyExists(err) || isWalletSuspended(err)) {
        setForceRead(true);
        void queryClient.invalidateQueries({ queryKey: CUSTODIAL_WALLET_KEY });
      }
    },
  });

  const balance = wallet?.balance;
  const balanceUsdx =
    balance != null && Number.isFinite(Number(balance)) ? Number(balance) : null;

  const hasWallet = status !== "none";
  const address = wallet?.address ?? (hasWallet ? (summary?.address ?? null) : null);
  const isActive = status === "ACTIVE" && !!address;
  const balanceState: CustodialBalanceState = !hasWallet
    ? "none"
    : enabled && query.isPending
      ? "loading"
      : balanceUsdx == null
        ? "unavailable"
        : "ready";

  return {
    summary,
    status,
    hasWallet,
    address,
    isActive,
    balanceState,
    pinSet: typeof user?.pinSet === "boolean" ? user.pinSet : null,
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTODIAL_WALLET_KEY });
    },
    wallet,
    balanceUsdx,
    balanceAt: balanceUsdx == null ? null : (wallet?.balanceAt ?? null),
    isLoading: enabled && query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    create: async () => {
      try {
        await createMutation.mutateAsync();
      } catch {
        // Ditampilkan lewat `createError`; komponen tidak perlu try/catch.
      }
    },
    createPending: createMutation.isPending,
    createError: createMutation.error,
    isPolling,
    provisioningTimedOut: status === "PROVISIONING" && exhausted,
  };
}
