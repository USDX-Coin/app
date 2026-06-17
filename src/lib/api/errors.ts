// Shared helpers for reacting to `ApiError` across forms/hooks (USDX-150).
// Centralizes the SoT auth error-code semantics so each call site stays terse.

import { ApiError } from "./client";

export { ApiError };

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
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

// 429 — rate limited (TOO_MANY_ATTEMPTS / TOO_MANY_REQUESTS). Returns seconds to
// wait if known, else null.
export function getRateLimitSeconds(error: unknown): number | null {
  if (isApiError(error) && error.status === 429) return error.retryAfterSeconds ?? 0;
  return null;
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
