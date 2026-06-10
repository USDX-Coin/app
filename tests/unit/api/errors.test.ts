import { describe, test, expect } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  isApiError,
  getErrorMessage,
  isEmailNotVerified,
  isAccountSuspended,
  getRateLimitSeconds,
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

    test("getRateLimitSeconds returns seconds from a 429 ApiError", () => {
      expect(getRateLimitSeconds(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", undefined, 42))).toBe(42);
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
