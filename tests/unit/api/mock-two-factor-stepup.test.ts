import { describe, test, expect, beforeEach } from "vitest";
import {
  MOCK_BACKUP_CODES,
  MOCK_RECOVERY_OTP,
  MOCK_TOTP_CODE,
  assertMockOutboundNotLocked,
  mockDisableTwoFactor,
  mockEnableTwoFactor,
  mockOutboundLockedUntil,
  mockRegenerateBackupCodes,
  mockTwoFactorRecovery,
  mockVerifyTwoFactor,
  resetMockTwoFactor,
  seedMockOutboundLock,
  seedMockTwoFactor,
  startMockTwoFactorChallenge,
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

// Kunci 24 jam uang keluar custodial (§6.1 no.6): setiap faktor kedua DIMATIKAN
// ATAU DIGANTI — disable, pemulihan email, regenerate backup code, enable ulang saat
// aktif. Aktivasi pertama tidak mengunci (no.9). Kunci milik akun, bertahan walau
// 2FA diaktifkan lagi.
const DAY_MS = 24 * 60 * 60 * 1000;

function lockedForAboutADay(): boolean {
  const until = mockOutboundLockedUntil();
  if (until === null) return false;
  const ms = Date.parse(until) - Date.now();
  return ms > DAY_MS - 60_000 && ms <= DAY_MS;
}

describe("mock outbound lock", () => {
  describe("positive", () => {
    test("turning 2FA off locks money out for 24 hours", async () => {
      seedMockTwoFactor(true);
      await mockDisableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      expect(lockedForAboutADay()).toBe(true);
      expect(thrown(() => assertMockOutboundNotLocked())).toMatchObject({
        status: 409,
        code: "CUSTODIAL_OUTBOUND_LOCKED",
        details: { lockedUntil: mockOutboundLockedUntil() },
      });
    });

    test("new backup codes lock; so does a re-enable while 2FA is already on", async () => {
      seedMockTwoFactor(true);
      await mockRegenerateBackupCodes({ password: "Demo1234" }, { passwordOk: true });
      expect(lockedForAboutADay()).toBe(true);

      seedMockOutboundLock(null);
      await mockEnableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      expect(lockedForAboutADay()).toBe(true);
    });

    test("email recovery locks", async () => {
      seedMockTwoFactor(true);
      startMockTwoFactorChallenge("demo@usdx.com");
      await mockTwoFactorRecovery({});
      await mockTwoFactorRecovery({ code: MOCK_RECOVERY_OTP });
      expect(lockedForAboutADay()).toBe(true);
    });

    test("the lock survives turning 2FA back on", async () => {
      seedMockTwoFactor(true);
      await mockDisableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      await mockEnableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      await mockVerifyTwoFactor({ code: MOCK_TOTP_CODE });
      expect(lockedForAboutADay()).toBe(true);
    });
  });

  describe("negative", () => {
    test("no lock by default, and the first activation does not lock", async () => {
      expect(mockOutboundLockedUntil()).toBeNull();
      await mockEnableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      await mockVerifyTwoFactor({ code: MOCK_TOTP_CODE });
      expect(mockOutboundLockedUntil()).toBeNull();
      expect(() => assertMockOutboundNotLocked()).not.toThrow();
    });

    test("a failed disable (wrong password) does not lock", async () => {
      seedMockTwoFactor(true);
      await expect(
        mockDisableTwoFactor({ password: "nope" }, { passwordOk: false }),
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
      expect(mockOutboundLockedUntil()).toBeNull();
    });
  });

  describe("edge case", () => {
    test("a lock in the past reads as null and lets money out", () => {
      seedMockOutboundLock(new Date(Date.now() - 1_000).toISOString());
      expect(mockOutboundLockedUntil()).toBeNull();
      expect(() => assertMockOutboundNotLocked()).not.toThrow();
    });
  });
});
