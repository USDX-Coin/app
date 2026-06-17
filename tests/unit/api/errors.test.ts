import { describe, test, expect } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  isApiError,
  getErrorMessage,
  isEmailNotVerified,
  isAccountSuspended,
  isKycNotVerified,
  isMintDisabled,
  getRateLimitSeconds,
  isInvalidCredentials,
  hasErrorCode,
} from "@/lib/api/errors";

describe("errors helpers", () => {
  describe("positive", () => {
    test("isApiError narrows ApiError instances", () => {
      expect(isApiError(new ApiError(400, "BAD_REQUEST", "x"))).toBe(true);
      expect(isApiError(new Error("x"))).toBe(false);
    });

    test("isEmailNotVerified matches 403 EMAIL_NOT_VERIFIED only", () => {
      expect(isEmailNotVerified(new ApiError(403, "EMAIL_NOT_VERIFIED", "x"))).toBe(true);
      expect(isEmailNotVerified(new ApiError(403, "KYC_NOT_VERIFIED", "x"))).toBe(false);
      expect(isEmailNotVerified(new ApiError(401, "EMAIL_NOT_VERIFIED", "x"))).toBe(false);
    });

    test("isAccountSuspended matches 403 ACCOUNT_SUSPENDED", () => {
      expect(isAccountSuspended(new ApiError(403, "ACCOUNT_SUSPENDED", "x"))).toBe(true);
      expect(isAccountSuspended(new ApiError(403, "EMAIL_NOT_VERIFIED", "x"))).toBe(false);
    });

    test("isKycNotVerified matches 403 KYC_NOT_VERIFIED only", () => {
      expect(isKycNotVerified(new ApiError(403, "KYC_NOT_VERIFIED", "x"))).toBe(true);
      expect(isKycNotVerified(new ApiError(403, "EMAIL_NOT_VERIFIED", "x"))).toBe(false);
      expect(isKycNotVerified(new ApiError(401, "KYC_NOT_VERIFIED", "x"))).toBe(false);
    });

    test("isMintDisabled matches 503 MINT_DISABLED only", () => {
      expect(isMintDisabled(new ApiError(503, "MINT_DISABLED", "x"))).toBe(true);
      expect(isMintDisabled(new ApiError(403, "MINT_DISABLED", "x"))).toBe(false);
      expect(isMintDisabled(new ApiError(503, "SERVICE_UNAVAILABLE", "x"))).toBe(false);
    });

    test("getRateLimitSeconds returns seconds from a 429 ApiError", () => {
      expect(getRateLimitSeconds(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", undefined, 42))).toBe(42);
    });

    test("isInvalidCredentials matches 401 INVALID_CREDENTIALS only", () => {
      expect(isInvalidCredentials(new ApiError(401, "INVALID_CREDENTIALS", "x"))).toBe(true);
      expect(isInvalidCredentials(new ApiError(401, "UNAUTHORIZED", "x"))).toBe(false);
      expect(isInvalidCredentials(new ApiError(400, "INVALID_CREDENTIALS", "x"))).toBe(false);
    });

    test("hasErrorCode matches the code regardless of status", () => {
      expect(hasErrorCode(new ApiError(400, "PASSWORD_MISMATCH", "x"), "PASSWORD_MISMATCH")).toBe(true);
      expect(hasErrorCode(new ApiError(400, "WEAK_PASSWORD", "x"), "PASSWORD_MISMATCH")).toBe(false);
      expect(hasErrorCode(new Error("x"), "WEAK_PASSWORD")).toBe(false);
    });
  });

  describe("negative", () => {
    test("getRateLimitSeconds returns null for non-429 and non-ApiError", () => {
      expect(getRateLimitSeconds(new ApiError(400, "BAD_REQUEST", "x"))).toBeNull();
      expect(getRateLimitSeconds(new Error("x"))).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("getRateLimitSeconds returns 0 for a 429 without Retry-After info", () => {
      expect(getRateLimitSeconds(new ApiError(429, "TOO_MANY_ATTEMPTS", "x"))).toBe(0);
    });

    test("getErrorMessage prefers the error message and falls back cleanly", () => {
      expect(getErrorMessage(new ApiError(400, "BAD_REQUEST", "boom"))).toBe("boom");
      expect(getErrorMessage(new Error("plain"))).toBe("plain");
      expect(getErrorMessage("not-an-error", "fallback")).toBe("fallback");
      expect(getErrorMessage(new ApiError(400, "BAD_REQUEST", ""), "fallback")).toBe("fallback");
    });
  });
});
