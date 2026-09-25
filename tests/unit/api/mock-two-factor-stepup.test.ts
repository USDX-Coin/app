import { describe, test, expect, beforeEach } from "vitest";
import {
  MOCK_BACKUP_CODES,
  MOCK_TOTP_CODE,
  resetMockTwoFactor,
  seedMockTwoFactor,
  verifyMockStepUpCode,
} from "@/lib/api/mock-two-factor";

// Step-up 2FA for custodial money out (custodial-wallet.md §6.1, USDX-717) — the
// mock plays backend USDX-718 so the transfer/redeem dialogs run offline. Order of
// checks: 2FA on? → code present? → lockout `2fa-stepup`? → code valid?

beforeEach(() => {
  localStorage.clear();
  resetMockTwoFactor();
});

function thrown(fn: () => void): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return null;
}

describe("verifyMockStepUpCode", () => {
  describe("positive", () => {
    test("accepts the TOTP code on a 2FA account", () => {
      seedMockTwoFactor(true);
      expect(() => verifyMockStepUpCode(MOCK_TOTP_CODE)).not.toThrow();
    });

    test("accepts a backup code exactly once", () => {
      seedMockTwoFactor(true);
      expect(() => verifyMockStepUpCode(MOCK_BACKUP_CODES[0])).not.toThrow();
      expect(thrown(() => verifyMockStepUpCode(MOCK_BACKUP_CODES[0]))).toMatchObject({
        status: 401,
        code: "INVALID_TWO_FACTOR_CODE",
      });
    });

    test("a right code resets the failure count", () => {
      seedMockTwoFactor(true);
      for (let i = 0; i < 4; i++) thrown(() => verifyMockStepUpCode("000000"));
      verifyMockStepUpCode(MOCK_TOTP_CODE);
      for (let i = 0; i < 4; i++) {
        expect(thrown(() => verifyMockStepUpCode("000000"))).toMatchObject({ status: 401 });
      }
    });
  });

  describe("negative", () => {
    test("401 TWO_FACTOR_SETUP_REQUIRED when 2FA is off, whatever the code", () => {
      expect(thrown(() => verifyMockStepUpCode(MOCK_TOTP_CODE))).toMatchObject({
        status: 401,
        code: "TWO_FACTOR_SETUP_REQUIRED",
      });
    });

    test("401 TWO_FACTOR_CODE_REQUIRED when the code is absent or blank", () => {
      seedMockTwoFactor(true);
      expect(thrown(() => verifyMockStepUpCode(undefined))).toMatchObject({
        status: 401,
        code: "TWO_FACTOR_CODE_REQUIRED",
      });
      expect(thrown(() => verifyMockStepUpCode("  "))).toMatchObject({ code: "TWO_FACTOR_CODE_REQUIRED" });
    });

    test("401 INVALID_TWO_FACTOR_CODE for a wrong code", () => {
      seedMockTwoFactor(true);
      expect(thrown(() => verifyMockStepUpCode("000000"))).toMatchObject({
        status: 401,
        code: "INVALID_TWO_FACTOR_CODE",
      });
    });
  });

  describe("edge case", () => {
    test("5 wrong codes → 429 TOO_MANY_ATTEMPTS scope 2fa-stepup, even for the right code", () => {
      seedMockTwoFactor(true);
      for (let i = 0; i < 5; i++) thrown(() => verifyMockStepUpCode("000000"));
      const err = thrown(() => verifyMockStepUpCode(MOCK_TOTP_CODE));
      expect(err).toMatchObject({
        status: 429,
        code: "TOO_MANY_ATTEMPTS",
        details: { scope: "2fa-stepup" },
      });
      expect((err as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
    });

    test("SETUP_REQUIRED comes before the lockout and before the code check", () => {
      expect(thrown(() => verifyMockStepUpCode(undefined))).toMatchObject({
        code: "TWO_FACTOR_SETUP_REQUIRED",
      });
    });
  });
});
