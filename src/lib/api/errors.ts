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

// Narrow to a specific SoT error code (e.g. PASSWORD_MISMATCH, WEAK_PASSWORD)
// regardless of status, so call sites can route 400s to the right field.
export function hasErrorCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}
