// Wallet custodial API (wallet.yaml — Gelombang 1 USDX-551, FE USDX-566).
// Satu pintu untuk `/api/v2/wallet`; di dalamnya bercabang ke backend sungguhan
// atau lapisan mock berdasarkan `env.useMock`, pola `auth-api.ts`.
//
// Tiga endpoint: get + create (USDX-566) dan transfer (USDX-567).
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
// - `transferCustodial` — `POST /api/v2/wallet/transfer` (USDX-567). Header
//   `Idempotency-Key` WAJIB (UUID, dibuat pemanggil SEKALI per niat transfer —
//   dibuat ulang saat tujuan/jumlah sengaja diubah, TIDAK saat retry). 202 = bukti
//   broadcast, 200 = replay dengan hasil identik; `apiFetch` membuka envelope-nya
//   sehingga keduanya sampai sebagai `TransferAccepted` yang sama — FE memang tidak
//   boleh memperlakukan keduanya berbeda. `skipUnauthorizedHandler`: 401 di sini
//   hampir selalu `INVALID_PIN` / `PIN_NOT_SET` (pin.yaml), bukan sesi mati —
//   salah ketik PIN tidak boleh berakhir dengan logout.

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import { isWalletNotFound } from "./errors";
import type { CustodialWallet, TransferAccepted } from "@/types";
import type { CreateTransferRequest } from "./types";
import {
  mockCreateCustodialWallet,
  mockGetCustodialWallet,
  mockTransferCustodial,
} from "./mock-custodial-wallet";

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

export async function transferCustodial(
  req: CreateTransferRequest,
  idempotencyKey: string,
): Promise<TransferAccepted> {
  if (env.useMock) return mockTransferCustodial(req, idempotencyKey);
  return apiFetch<TransferAccepted>("/api/v2/wallet/transfer", {
    method: "POST",
    body: req,
    headers: { "Idempotency-Key": idempotencyKey },
    skipUnauthorizedHandler: true,
  });
}
