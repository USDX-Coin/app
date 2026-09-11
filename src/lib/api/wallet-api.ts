// Wallet custodial API (wallet.yaml — Gelombang 1 USDX-551, FE USDX-566).
// Satu pintu untuk `/api/v2/wallet`; di dalamnya bercabang ke backend sungguhan
// atau lapisan mock berdasarkan `env.useMock`, pola `auth-api.ts`.
//
// Dua endpoint saja untuk tiket ini — transfer (`POST /api/v2/wallet/transfer`)
// adalah USDX-567 dan sengaja tidak disentuh di sini.
//
// - `getCustodialWallet` — `GET /api/v2/wallet`. 404 `WALLET_NOT_FOUND` adalah
//   keadaan NORMAL (user non-custodial), bukan kegagalan: dikembalikan sebagai
//   `null`, bukan dilempar, supaya tidak ada pemanggil yang men-toast-nya. Error
//   lain tetap dilempar apa adanya. Yang menentukan APAKAH endpoint ini dipanggil
//   adalah `user.custodialWallet` dari `/auth/me` (hook), bukan fungsi ini.
// - `createCustodialWallet` — `POST /api/v2/wallet`. Selalu `202 PROVISIONING`
//   (address null); panggilan ulang saat masih PROVISIONING → `202` yang sama,
//   jadi tombol "coba lagi" aman dan sekaligus menjadi jalur penyembuh salinan
//   kerja backend (`custodial-wallet.md` §5.5). 409 `WALLET_ALREADY_EXISTS` /
//   `WALLET_SUSPENDED` dan 503 `WALLET_SERVICE_UNAVAILABLE` dilempar ke pemanggil.

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import { isWalletNotFound } from "./errors";
import type { CustodialWallet } from "@/types";
import { mockCreateCustodialWallet, mockGetCustodialWallet } from "./mock-api";

export async function getCustodialWallet(): Promise<CustodialWallet | null> {
  try {
    if (env.useMock) return await mockGetCustodialWallet();
    return await apiFetch<CustodialWallet>("/api/v2/wallet", { method: "GET" });
  } catch (err) {
    if (isWalletNotFound(err)) return null;
    throw err;
  }
}

export async function createCustodialWallet(): Promise<CustodialWallet> {
  if (env.useMock) return mockCreateCustodialWallet();
  return apiFetch<CustodialWallet>("/api/v2/wallet", { method: "POST" });
}
