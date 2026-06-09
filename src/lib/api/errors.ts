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

// 429 — rate limited (TOO_MANY_ATTEMPTS / TOO_MANY_REQUESTS). Returns seconds to
// wait if known, else null.
export function getRateLimitSeconds(error: unknown): number | null {
  if (isApiError(error) && error.status === 429) return error.retryAfterSeconds ?? 0;
  return null;
}
