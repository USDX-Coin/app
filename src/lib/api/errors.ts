// Shared helpers for reacting to `ApiError` across forms/hooks (USDX-150).
// Centralizes the SoT auth error-code semantics so each call site stays terse.

import { ApiError } from "./client";

export { ApiError };

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// Dilempar `uploadToPresignedUrl` saat bucket menjawab PUT presigned dengan status
// non-2xx. Sengaja BUKAN `ApiError`: yang itu khusus balasan `/api/v2/*` yang
// berformat envelope SoT dan punya `code`, sedangkan ini datang dari origin bucket
// dan hanya membawa status HTTP. Statusnya disimpan supaya pemanggil bisa
// membedakan "berkasnya yang ditolak" (mengunggah ulang masuk akal) dari "bucket
// atau URL presigned-nya yang bermasalah" (mengunggah ulang tidak akan menolong) —
// lihat `classifyUploadError` di hooks/useKyc.
export class PresignedUploadError extends Error {
  status: number;

  constructor(status: number) {
    super(`Presigned upload failed (${status})`);
    this.name = "PresignedUploadError";
    this.status = status;
  }
}

export function isPresignedUploadError(error: unknown): error is PresignedUploadError {
  return error instanceof PresignedUploadError;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

// Kunci i18n untuk kegagalan yang BUKAN salah user dan bukan aturan bisnis:
// koneksi mati dan server error. Temuan B3 — `getErrorMessage` meneruskan pesan
// mentah dari backend ("boom") dan dari fetch ("Failed to fetch") apa adanya ke
// toast. Pesan begitu tidak menjelaskan apa yang terjadi dan tidak memberi jalan
// keluar. Yang lain (4xx dengan `code` SoT) tetap dipetakan per layar oleh
// pemanggilnya, jadi fungsi ini mengembalikan null dan pemanggil memakai
// kalimatnya sendiri.
export function getFailureKey(error: unknown): string | null {
  if (isApiError(error)) return error.status >= 500 ? "error.server" : null;
  // fetch() menolak dengan TypeError saat jaringan/DNS/CORS gagal — tidak pernah
  // dengan status. Ini satu-satunya sinyal "offline" yang kita punya.
  if (error instanceof TypeError) return "error.offline";
  return null;
}

/**
 * Kalimat yang layak ditampilkan untuk sebuah kegagalan: pesan jaringan/server
 * kalau memang itu masalahnya, kalau bukan kalimat milik layar itu sendiri.
 * Pesan mentah dari backend tidak pernah ikut.
 */
export function getFailureText(
  t: (key: string, vars?: Record<string, string>) => string,
  error: unknown,
  fallbackKey: string
): string {
  return t(getFailureKey(error) ?? fallbackKey);
}

// 403 EMAIL_NOT_VERIFIED — backend asks the user to verify before continuing.
// auth.yaml login/kyc/storage. `details.resendUrl` may accompany it.
export function isEmailNotVerified(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code === "EMAIL_NOT_VERIFIED";
}

export function isAccountSuspended(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code === "ACCOUNT_SUSPENDED";
}


// 403 KYC_NOT_VERIFIED — consumer gate (common.yaml § ConsumerGateForbidden).
// User must finish KYC before transacting; surface the /kyc CTA, not a toast.
export function isKycNotVerified(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code === "KYC_NOT_VERIFIED";
}

// 503 MINT_DISABLED — mint gated off in this environment (no real payment
// provider yet; week2.md § Environment gate). Surface "mint belum dibuka".
export function isMintDisabled(error: unknown): boolean {
  return isApiError(error) && error.status === 503 && error.code === "MINT_DISABLED";
}

// 503 MINT_UNDER_MAINTENANCE — this user is not on the list that may mint right
// now (USDX-636 gates minting to testers while the test bundle runs). Distinct
// from MINT_DISABLED, which is the whole environment being off. Reached when the
// gate changes mid-session, after `mintAvailable` was already read as true.
// Surface the maintenance notice — never the test mode, which is our word, not
// something an ordinary user should have to learn.
export function isMintUnderMaintenance(error: unknown): boolean {
  return isApiError(error) && error.status === 503 && error.code === "MINT_UNDER_MAINTENANCE";
}

// 422 VALIDATION_ERROR — body/input validation failure on any /api/v2/* endpoint
// (conventions.md § Validation Error (v2); USDX-213 BE / USDX-214 FE). The v2
// global pipe emits 422 (not 400) with code VALIDATION_ERROR. We match on the SoT
// *code* (status-agnostic) so a form treats it as an input error — surface the
// field / inline validation message, never the generic catch-all. Business
// failures keep their own code (e.g. 409 ADDRESS_ALREADY_EXISTS) and don't match.
export function isValidationError(error: unknown): boolean {
  return isApiError(error) && error.code === "VALIDATION_ERROR";
}

// 429 — rate limited (TOO_MANY_ATTEMPTS / TOO_MANY_REQUESTS / RATE_LIMITED).
// Returns seconds to wait if known, else null.
export function getRateLimitSeconds(error: unknown): number | null {
  if (isApiError(error) && error.status === 429) return error.retryAfterSeconds ?? 0;
  return null;
}

// 429 RATE_LIMITED — throughput throttle on mint/redeem (5 req/s per user;
// conventions.md § Rate Limiting (Redis)). Distinct from auth's TOO_MANY_ATTEMPTS
// (wrong-credential attempts) / TOO_MANY_REQUESTS (resend cooldown), which drive a
// countdown. A transient throttle, NOT a session error — handle with a backoff +
// toast, and never logout (unlike 401).
export function isRateLimited(error: unknown): boolean {
  return isApiError(error) && error.status === 429 && error.code === "RATE_LIMITED";
}

// 422 INSUFFICIENT_BALANCE — redeem pre-check: the burn wallet's USDX balance is
// below the amount (week3.md § Week 3 Addendum, best-effort RPC balanceOf). The FE
// already gates this client-side via the precondition read; this is the backend
// backstop at create. Surface inline ("saldo USDX tidak cukup"), not a toast.
export function isInsufficientBalance(error: unknown): boolean {
  return isApiError(error) && error.status === 422 && error.code === "INSUFFICIENT_BALANCE";
}

// 422 WALLET_BLACKLISTED — redeem pre-check: the burn wallet is blacklisted
// on-chain (week3.md § Week 3 Addendum; the contract reverts regardless). Surface
// inline so the user knows this wallet can't burn.
export function isWalletBlacklisted(error: unknown): boolean {
  return isApiError(error) && error.status === 422 && error.code === "WALLET_BLACKLISTED";
}

// 409 INVALID_ORDER_STATE — reporting a burn tx (or acting) on an order that
// isn't AWAITING_BURN/EXPIRED (week3.md § burn-tx endpoint). The scanner is the
// arbiter; treat as a benign "already moved on" rather than a hard failure.
export function isInvalidOrderState(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && error.code === "INVALID_ORDER_STATE";
}

// 503 REDEEM_DISABLED — redeem gated off in this environment: no real
// disbursement provider yet, so production refuses the order to avoid burning
// USDX with no payout (week3.md § Environment gate). Mirror isMintDisabled —
// surface "redeem belum dibuka", not a generic error.
export function isRedeemDisabled(error: unknown): boolean {
  return isApiError(error) && error.status === 503 && error.code === "REDEEM_DISABLED";
}

// 422 INVALID_BANK_ACCOUNT — the disbursement provider's account inquiry rejected
// the destination at create (week3.md § Endpoints Redeem). Validation happens
// before the burn (burn is irreversible); surface inline on the bank fields.
export function isInvalidBankAccount(error: unknown): boolean {
  return isApiError(error) && error.status === 422 && error.code === "INVALID_BANK_ACCOUNT";
}

// 401 INVALID_CREDENTIALS — generic "wrong password" (auth.yaml login /
// changePasswordV2). For change-password this is the wrong *current* password,
// surfaced inline rather than treated as an expired session.
export function isInvalidCredentials(error: unknown): boolean {
  return isApiError(error) && error.status === 401 && error.code === "INVALID_CREDENTIALS";
}

// ── Wallet custodial (wallet.yaml § PETA KODE 409, USDX-566) ─────────────────
// FE bercabang dari `code`, bukan dari status HTTP: tiga kondisi 409 beririsan.

// 404 WALLET_NOT_FOUND — user belum punya wallet custodial. Keadaan NORMAL
// (user non-custodial selalu dapat ini dari GET), bukan kegagalan: `wallet-api`
// mengubahnya jadi `null`, jangan pernah di-toast.
export function isWalletNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404 && error.code === "WALLET_NOT_FOUND";
}

// 404 WALLET_TRANSFER_NOT_FOUND — GET /wallet/transfers/{id} (USDX-701): id basi,
// salah, atau milik user lain (dijawab sama persis). Bukan kegagalan sistem — FE
// tampilkan pesan netral + jalan kembali ke riwayat.
export function isWalletTransferNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404 && error.code === "WALLET_TRANSFER_NOT_FOUND";
}

// 409 WALLET_ALREADY_EXISTS — POST /wallet saat wallet sudah ACTIVE. Satu user =
// satu wallet; FE arahkan ke GET, bukan menawarkan onboarding lagi.
export function isWalletAlreadyExists(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && error.code === "WALLET_ALREADY_EXISTS";
}

// 409 WALLET_SUSPENDED — POST /wallet saat wallet ada tapi SUSPENDED (keputusan
// ops/insiden). Tidak ada wallet pengganti; pemulihan lewat runbook ops.
export function isWalletSuspended(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && error.code === "WALLET_SUSPENDED";
}

// 409 WALLET_NOT_ACTIVE — punya wallet tapi PROVISIONING / SUSPENDED, di
// /wallet/transfer dan POST /redeem. FE tampilkan status wallet, JANGAN tawarkan
// retry: statusnya tidak berubah karena ditekan lagi.
export function isWalletNotActive(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && error.code === "WALLET_NOT_ACTIVE";
}

// 503 WALLET_SERVICE_UNAVAILABLE — zona kunci (wallet-service / Web3Signer /
// Vault) tak terjangkau (common.yaml § WalletServiceUnavailable). Aman di-retry:
// tidak ada state yang terlanjur berubah. Beda dari MINT_DISABLED (gate produk).
export function isWalletServiceUnavailable(error: unknown): boolean {
  return (
    isApiError(error) && error.status === 503 && error.code === "WALLET_SERVICE_UNAVAILABLE"
  );
}

// 503 NETWORK_CONGESTED — fee jaringan Polygon melewati plafon pengaman, transfer
// ditolak SEBELUM gas disiapkan dan ditandatangani (wallet.yaml § POST
// /wallet/transfer 503, custodial-wallet.md §5.4 cek no.1). Aman di-retry dengan
// Idempotency-Key yang SAMA. Bukan kesalahan layanan: user cukup menunggu.
export function isNetworkCongested(error: unknown): boolean {
  return isApiError(error) && error.status === 503 && error.code === "NETWORK_CONGESTED";
}

// 401 INVALID_PIN — PIN salah (pin.yaml; attempt dihitung ke lockout scope `pin`
// yang dibagi /auth/pin/verify, /change, /wallet/transfer, POST /redeem). Bukan
// sesi kedaluwarsa: pemanggil WAJIB `skipUnauthorizedHandler` supaya user tidak
// di-logout karena salah ketik PIN.
export function isInvalidPin(error: unknown): boolean {
  return isApiError(error) && error.status === 401 && error.code === "INVALID_PIN";
}

// 401 PIN_NOT_SET — akun belum punya PIN → arahkan ke pembuatan PIN
// (POST /api/v2/auth/pin/set), bukan minta PIN lagi.
export function isPinNotSet(error: unknown): boolean {
  return isApiError(error) && error.status === 401 && error.code === "PIN_NOT_SET";
}

// 401 REAUTH_REQUIRED — POST /auth/pin/set tanpa sesi password-auth segar (pin.yaml
// § set). Dua arti, dibedakan `details.pinSet` (`getReauthPinSet`): menimpa PIN
// yang sudah ada tanpa `currentPin` (USDX-328), atau first-time set di akun
// ber-wallet custodial (USDX-698). Bukan logout: sesinya masih valid.
export function isReauthRequired(error: unknown): boolean {
  return isApiError(error) && error.status === 401 && error.code === "REAUTH_REQUIRED";
}

// `details.pinSet` dari 401 REAUTH_REQUIRED (pin.yaml § set, additive 21 Sep 2026;
// USDX-697). `false` = akun BELUM punya PIN tapi punya wallet custodial, sesinya
// tidak segar → login ulang lalu buat PIN dalam 5 menit. `true` = akun SUDAH
// punya PIN → ubah PIN. Absen (backend lama) atau bukan boolean dibaca `true`:
// hanya `false` eksplisit yang berarti "belum punya PIN". Null = bukan
// REAUTH_REQUIRED.
export function getReauthPinSet(error: unknown): boolean | null {
  if (!isReauthRequired(error)) return null;
  const details = (error as ApiError).details;
  if (!details || typeof details !== "object") return true;
  return (details as Record<string, unknown>).pinSet !== false;
}

// 422 PIN_UNCHANGED — POST /auth/pin/change dengan `newPin` sama dengan
// `currentPin` (pin.yaml § change). Hanya keluar sesudah `currentPin` terbukti
// BENAR; PIN lama salah + PIN baru sama = 401 INVALID_PIN (attempt terbakar).
// FE menolak `newPin == currentPin` sebelum berangkat.
export function isPinUnchanged(error: unknown): boolean {
  return isApiError(error) && error.status === 422 && error.code === "PIN_UNCHANGED";
}

// 429 TOO_MANY_ATTEMPTS — lockout PIN scope `pin` (5 salah / 15 menit). Beda dari
// RATE_LIMITED (throttle throughput, toast global): ini kesalahan user yang
// butuh countdown inline; `getRateLimitSeconds` membaca Retry-After-nya.
export function isTooManyAttempts(error: unknown): boolean {
  return isApiError(error) && error.status === 429 && error.code === "TOO_MANY_ATTEMPTS";
}

// 409 IDEMPOTENCY_KEY_IN_PROGRESS — transfer dengan `Idempotency-Key` yang sama
// MASIH berjalan. FE: tunggu, lalu retry dengan key yang SAMA — jangan kirim ulang
// dengan key baru, karena yang pertama bisa saja sudah ter-broadcast.
export function isIdempotencyKeyInProgress(error: unknown): boolean {
  return (
    isApiError(error) && error.status === 409 && error.code === "IDEMPOTENCY_KEY_IN_PROGRESS"
  );
}

// 409 IDEMPOTENCY_KEY_REUSED — key dipakai ulang untuk body berbeda (atau key
// milik user lain). Ini BUG FE (key tidak dibuat ulang saat tujuan/jumlah
// berubah), bukan keadaan user — pemanggil membuang key-nya dan melapor.
export function isIdempotencyKeyReused(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && error.code === "IDEMPOTENCY_KEY_REUSED";
}

// 422 RECIPIENT_BLACKLISTED — address tujuan ter-blacklist on-chain
// (`isBlackListed`, pola mint week2). Tidak ada tanda tangan yang diminta.
export function isRecipientBlacklisted(error: unknown): boolean {
  return isApiError(error) && error.status === 422 && error.code === "RECIPIENT_BLACKLISTED";
}

// 422 TRANSFER_LIMIT_EXCEEDED — melewati plafon per-transaksi / harian (§6).
// Angkanya BUKAN bagian kontrak: dibaca dari `details`, jangan di-hardcode.
export function isTransferLimitExceeded(error: unknown): boolean {
  return (
    isApiError(error) && error.status === 422 && error.code === "TRANSFER_LIMIT_EXCEEDED"
  );
}

export interface TransferLimitDetails {
  limitType: "PER_TX" | "DAILY";
  limit: string;
  remaining: string;
  resetAt: string | null; // null untuk PER_TX
}

// `details` dari 422 TRANSFER_LIMIT_EXCEEDED (wallet.yaml). Null kalau bentuknya
// tidak seperti yang dijanjikan — pemanggil lalu memakai kalimat generik, bukan
// menampilkan `undefined` di tengah pesan.
export function getTransferLimitDetails(error: unknown): TransferLimitDetails | null {
  if (!isTransferLimitExceeded(error)) return null;
  const d = (error as ApiError).details;
  if (!d || typeof d !== "object") return null;
  const { limitType, limit, remaining, resetAt } = d as Record<string, unknown>;
  if (limitType !== "PER_TX" && limitType !== "DAILY") return null;
  if (typeof limit !== "string" || typeof remaining !== "string") return null;
  return {
    limitType,
    limit,
    remaining,
    resetAt: typeof resetAt === "string" ? resetAt : null,
  };
}

// Narrow to a specific SoT error code (e.g. PASSWORD_MISMATCH, WEAK_PASSWORD)
// regardless of status, so call sites can route 400s to the right field.
export function hasErrorCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}
