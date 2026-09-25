import { describe, test, expect } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  isInvalidTwoFactorCode,
  isTwoFactorChallengeExpired,
  isTwoFactorNotEnabled,
} from "@/lib/api/errors";

// 2FA error codes (two-factor.yaml, backend two-factor.service — USDX-714). The
// three are told apart by `code`; status is checked too so a stray code on another
// status never reads as a 2FA answer.
describe("two-factor error helpers", () => {
  describe("positive", () => {
    test("isInvalidTwoFactorCode matches 401 INVALID_TWO_FACTOR_CODE", () => {
      expect(isInvalidTwoFactorCode(new ApiError(401, "INVALID_TWO_FACTOR_CODE", "x"))).toBe(true);
    });

    test("isTwoFactorChallengeExpired matches 401 TWO_FACTOR_CHALLENGE_EXPIRED", () => {
      expect(
        isTwoFactorChallengeExpired(new ApiError(401, "TWO_FACTOR_CHALLENGE_EXPIRED", "x")),
      ).toBe(true);
    });

    test("isTwoFactorNotEnabled matches 400 TWO_FACTOR_NOT_ENABLED", () => {
      expect(isTwoFactorNotEnabled(new ApiError(400, "TWO_FACTOR_NOT_ENABLED", "x"))).toBe(true);
    });
  });

  describe("negative", () => {
    test("a wrong password (401 INVALID_CREDENTIALS) is none of them", () => {
      const err = new ApiError(401, "INVALID_CREDENTIALS", "x");
      expect(isInvalidTwoFactorCode(err)).toBe(false);
      expect(isTwoFactorChallengeExpired(err)).toBe(false);
      expect(isTwoFactorNotEnabled(err)).toBe(false);
    });

    test("the right code on another status does not match", () => {
      expect(isInvalidTwoFactorCode(new ApiError(422, "INVALID_TWO_FACTOR_CODE", "x"))).toBe(false);
      expect(
        isTwoFactorChallengeExpired(new ApiError(403, "TWO_FACTOR_CHALLENGE_EXPIRED", "x")),
      ).toBe(false);
      expect(isTwoFactorNotEnabled(new ApiError(409, "TWO_FACTOR_NOT_ENABLED", "x"))).toBe(false);
    });
  });

  describe("edge case", () => {
    test("non-ApiError values never match", () => {
      for (const value of [new Error("INVALID_TWO_FACTOR_CODE"), null, undefined, "x"]) {
        expect(isInvalidTwoFactorCode(value)).toBe(false);
        expect(isTwoFactorChallengeExpired(value)).toBe(false);
        expect(isTwoFactorNotEnabled(value)).toBe(false);
      }
    });
  });
});
