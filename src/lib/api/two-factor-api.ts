// 2FA TOTP (two-factor.yaml, USDX-714). Enroll / matikan / regenerate / login
// langkah 2 / pemulihan email — sebelumnya hanya ada di mobile; 2FA sekarang WAJIB
// untuk uang keluar custodial (custodial-wallet.md §6.1), jadi web menanganinya.
//
// Dua kelompok:
// - Session-gated (enable, verify, disable, regenerate): 401 di sini = password
//   atau kode salah — jawaban di dalam form, BUKAN sesi mati →
//   `skipUnauthorizedHandler` (pola PIN). Salah ketik tidak boleh berakhir logout.
// - Sebelum sesi (verify-login, recovery/email): yang mengenali user hanya cookie
//   challenge `two_factor` dari login langkah 1 (ikut otomatis lewat
//   `credentials: "include"`). Tanpa bearer (`skipAuth`), dan 401 = ulangi login.
//
// Field `code` / `password` tidak pernah dicatat di mana pun di klien.

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import { toAuthResponse, type AuthTokenV2 } from "./auth-api";
import { isMockCurrentPassword, mockVerifyTwoFactorLogin } from "./mock-api";
import {
  mockDisableTwoFactor,
  mockEnableTwoFactor,
  mockRegenerateBackupCodes,
  mockTwoFactorRecovery,
  mockVerifyTwoFactor,
} from "./mock-two-factor";
import type { AuthResponse, TwoFactorEnrollment } from "@/types";
import type {
  DisableTwoFactorRequest,
  TwoFactorCodeRequest,
  TwoFactorPasswordRequest,
} from "./types";

const IN_FORM = { method: "POST", skipUnauthorizedHandler: true } as const;
const BEFORE_SESSION = { method: "POST", skipAuth: true, skipUnauthorizedHandler: true } as const;

// Mock: akun (dan password-nya) milik mock-api; mock-two-factor hanya menerima hasilnya.
function mockPasswordCheck(req: TwoFactorPasswordRequest | DisableTwoFactorRequest) {
  return { passwordOk: "password" in req && isMockCurrentPassword(req.password) };
}

/** Mulai enroll (password-gated): QR + backup code. 2FA BELUM aktif sampai `verifyTwoFactor`. */
export async function enableTwoFactor(req: TwoFactorPasswordRequest): Promise<TwoFactorEnrollment> {
  if (env.useMock) return mockEnableTwoFactor(req, mockPasswordCheck(req));
  return apiFetch<TwoFactorEnrollment>("/api/v2/auth/2fa/enable", { ...IN_FORM, body: req });
}

/** Finalisasi enroll dengan kode TOTP 6 digit → 2FA aktif. */
export async function verifyTwoFactor(req: TwoFactorCodeRequest): Promise<void> {
  if (env.useMock) return mockVerifyTwoFactor(req);
  await apiFetch<void>("/api/v2/auth/2fa/verify", { ...IN_FORM, body: req });
}

/**
 * Matikan 2FA — password ATAU kode TOTP. Bila 2FA memang aktif, backend (USDX-718)
 * mengunci transfer & redeem custodial 24 jam; FE memperingatkan SEBELUM konfirmasi.
 */
export async function disableTwoFactor(req: DisableTwoFactorRequest): Promise<void> {
  if (env.useMock) return mockDisableTwoFactor(req, mockPasswordCheck(req));
  await apiFetch<void>("/api/v2/auth/2fa/disable", { ...IN_FORM, body: req });
}

/** Ganti SELURUH set backup code (password-gated); set lama langsung mati. */
export async function regenerateBackupCodes(req: TwoFactorPasswordRequest): Promise<string[]> {
  if (env.useMock) return (await mockRegenerateBackupCodes(req, mockPasswordCheck(req))).backupCodes;
  const data = await apiFetch<{ backupCodes: string[] }>(
    "/api/v2/auth/2fa/backup-codes/regenerate",
    { ...IN_FORM, body: req },
  );
  return data.backupCodes;
}

/** Login langkah 2: kode TOTP atau backup code di atas challenge → sesi. */
export async function verifyTwoFactorLogin(req: TwoFactorCodeRequest): Promise<AuthResponse> {
  if (env.useMock) return mockVerifyTwoFactorLogin(req);
  const data = await apiFetch<AuthTokenV2>("/api/v2/auth/2fa/verify-login", {
    ...BEFORE_SESSION,
    body: req,
  });
  return toAuthResponse(data);
}

/**
 * Pemulihan via email (sesudah login langkah 1): tanpa `code` = kirim OTP ke email;
 * dengan `code` = verifikasi → 2FA dimatikan (TANPA token — klien login ulang).
 */
export async function recoverTwoFactorViaEmail(code?: string): Promise<void> {
  const body = code ? { code } : {};
  if (env.useMock) return mockTwoFactorRecovery(body);
  await apiFetch<void>("/api/v2/auth/2fa/recovery/email", { ...BEFORE_SESSION, body });
}
