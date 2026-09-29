import { describe, test, expect, beforeEach } from "vitest";
import {
  MOCK_BACKUP_CODES,
  MOCK_RECOVERY_OTP,
  MOCK_TOTP_CODE,
  isMockTwoFactorEnabled,
  mockDisableTwoFactor,
  mockEnableTwoFactor,
  mockRegenerateBackupCodes,
  mockTwoFactorRecovery,
  mockVerifyTwoFactor,
  resetMockTwoFactor,
  seedMockTwoFactor,
  seedMockTwoFactorChallengeExpired,
  startMockTwoFactorChallenge,
  takeMockTwoFactorLogin,
} from "@/lib/api/mock-two-factor";

// Mock of two-factor.yaml (USDX-714) — plays the backend of USDX-312/313 so the web
// flows run offline: enroll → verify, disable (password OR TOTP), regenerate,
// login step 2 on the challenge, email recovery. The same `2fa-verify` lockout
// (5 wrong / 15 min) the backend keeps.

beforeEach(() => {
  localStorage.clear();
  resetMockTwoFactor();
});

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await expect(promise).rejects.toMatchObject({ status, code });
}

describe("mock two-factor", () => {
  describe("positive", () => {
    test("off by default; enable → pending until verify with the TOTP code", async () => {
      expect(isMockTwoFactorEnabled()).toBe(false);

      const enroll = await mockEnableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      expect(enroll.totpUri).toMatch(/^otpauth:\/\/totp\//);
      expect(enroll.totpUri).toContain("secret=");
      expect(enroll.backupCodes).toEqual(MOCK_BACKUP_CODES);
      expect(isMockTwoFactorEnabled()).toBe(false);

      await mockVerifyTwoFactor({ code: MOCK_TOTP_CODE });
      expect(isMockTwoFactorEnabled()).toBe(true);
    });

    test("disable with the password or with the TOTP code", async () => {
      seedMockTwoFactor(true);
      await mockDisableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      expect(isMockTwoFactorEnabled()).toBe(false);

      seedMockTwoFactor(true);
      await mockDisableTwoFactor({ code: MOCK_TOTP_CODE }, { passwordOk: false });
      expect(isMockTwoFactorEnabled()).toBe(false);
    });

    test("regenerate returns a fresh set; the old codes die", async () => {
      seedMockTwoFactor(true);
      const { backupCodes } = await mockRegenerateBackupCodes({ password: "x" }, { passwordOk: true });
      expect(backupCodes).toHaveLength(MOCK_BACKUP_CODES.length);
      expect(backupCodes).not.toEqual(MOCK_BACKUP_CODES);

      startMockTwoFactorChallenge("demo@usdx.com");
      await expectApiError(takeMockTwoFactorLogin(MOCK_BACKUP_CODES[0]), 401, "INVALID_TWO_FACTOR_CODE");
      startMockTwoFactorChallenge("demo@usdx.com");
      await expect(takeMockTwoFactorLogin(backupCodes[0])).resolves.toBe("demo@usdx.com");
    });

    test("login step 2: the TOTP code returns the pending email and consumes the challenge", async () => {
      seedMockTwoFactor(true);
      startMockTwoFactorChallenge("demo@usdx.com");

      await expect(takeMockTwoFactorLogin(MOCK_TOTP_CODE)).resolves.toBe("demo@usdx.com");
      await expectApiError(takeMockTwoFactorLogin(MOCK_TOTP_CODE), 401, "TWO_FACTOR_CHALLENGE_EXPIRED");
    });

    test("login step 2: a backup code works once", async () => {
      seedMockTwoFactor(true);
      startMockTwoFactorChallenge("demo@usdx.com");
      await expect(takeMockTwoFactorLogin(MOCK_BACKUP_CODES[1])).resolves.toBe("demo@usdx.com");

      startMockTwoFactorChallenge("demo@usdx.com");
      await expectApiError(takeMockTwoFactorLogin(MOCK_BACKUP_CODES[1]), 401, "INVALID_TWO_FACTOR_CODE");
    });

    test("email recovery: no code sends the OTP, the right OTP turns 2FA off", async () => {
      seedMockTwoFactor(true);
      startMockTwoFactorChallenge("demo@usdx.com");

      await expect(mockTwoFactorRecovery({})).resolves.toBeUndefined();
      await expect(mockTwoFactorRecovery({ code: MOCK_RECOVERY_OTP })).resolves.toBeUndefined();

      expect(isMockTwoFactorEnabled()).toBe(false);
      // The challenge is consumed: the client logs in again with email + password.
      await expectApiError(mockTwoFactorRecovery({}), 401, "TWO_FACTOR_CHALLENGE_EXPIRED");
    });
  });

  describe("negative", () => {
    test("enable with a wrong password → 401 INVALID_CREDENTIALS", async () => {
      await expectApiError(
        mockEnableTwoFactor({ password: "nope" }, { passwordOk: false }),
        401,
        "INVALID_CREDENTIALS",
      );
    });

    test("verify with a wrong code → 401, still not enabled", async () => {
      await mockEnableTwoFactor({ password: "Demo1234" }, { passwordOk: true });
      await expectApiError(mockVerifyTwoFactor({ code: "000000" }), 401, "INVALID_TWO_FACTOR_CODE");
      expect(isMockTwoFactorEnabled()).toBe(false);
    });

    test("verify / disable / regenerate without an enrollment → 400 TWO_FACTOR_NOT_ENABLED", async () => {
      await expectApiError(mockVerifyTwoFactor({ code: MOCK_TOTP_CODE }), 400, "TWO_FACTOR_NOT_ENABLED");
      await expectApiError(
        mockDisableTwoFactor({ password: "x" }, { passwordOk: true }),
        400,
        "TWO_FACTOR_NOT_ENABLED",
      );
      await expectApiError(
        mockRegenerateBackupCodes({ password: "x" }, { passwordOk: true }),
        400,
        "TWO_FACTOR_NOT_ENABLED",
      );
    });

    test("disable with a wrong password / a backup code → refused, still enabled", async () => {
      seedMockTwoFactor(true);
      await expectApiError(
        mockDisableTwoFactor({ password: "nope" }, { passwordOk: false }),
        401,
        "INVALID_CREDENTIALS",
      );
      // two-factor.service disable: `code` is a TOTP code only.
      await expectApiError(
        mockDisableTwoFactor({ code: MOCK_BACKUP_CODES[0] }, { passwordOk: false }),
        401,
        "INVALID_TWO_FACTOR_CODE",
      );
      expect(isMockTwoFactorEnabled()).toBe(true);
    });

    test("login step 2 without a challenge, or an expired one → TWO_FACTOR_CHALLENGE_EXPIRED", async () => {
      seedMockTwoFactor(true);
      await expectApiError(takeMockTwoFactorLogin(MOCK_TOTP_CODE), 401, "TWO_FACTOR_CHALLENGE_EXPIRED");

      startMockTwoFactorChallenge("demo@usdx.com");
      seedMockTwoFactorChallengeExpired();
      await expectApiError(takeMockTwoFactorLogin(MOCK_TOTP_CODE), 401, "TWO_FACTOR_CHALLENGE_EXPIRED");
    });

    test("email recovery with a wrong OTP → 401, 2FA stays on", async () => {
      seedMockTwoFactor(true);
      startMockTwoFactorChallenge("demo@usdx.com");
      await mockTwoFactorRecovery({});
      await expectApiError(mockTwoFactorRecovery({ code: "999999" }), 401, "INVALID_TWO_FACTOR_CODE");
      expect(isMockTwoFactorEnabled()).toBe(true);
    });
  });

  describe("edge case", () => {
    test("5 wrong codes lock `2fa-verify` → 429 TOO_MANY_ATTEMPTS with Retry-After, even for the right code", async () => {
      seedMockTwoFactor(true);
      startMockTwoFactorChallenge("demo@usdx.com");
      for (let i = 0; i < 5; i += 1) {
        await expectApiError(takeMockTwoFactorLogin("000000"), 401, "INVALID_TWO_FACTOR_CODE");
      }
      const locked = takeMockTwoFactorLogin(MOCK_TOTP_CODE);
      await expect(locked).rejects.toMatchObject({ status: 429, code: "TOO_MANY_ATTEMPTS" });
      await locked.catch((err: { retryAfterSeconds: number }) => {
        expect(err.retryAfterSeconds).toBeGreaterThan(0);
      });
    });

    test("a second OTP send inside the cooldown → 429 TOO_MANY_REQUESTS with Retry-After", async () => {
      seedMockTwoFactor(true);
      startMockTwoFactorChallenge("demo@usdx.com");
      await mockTwoFactorRecovery({});
      const again = mockTwoFactorRecovery({});
      await expect(again).rejects.toMatchObject({ status: 429, code: "TOO_MANY_REQUESTS" });
      await again.catch((err: { retryAfterSeconds: number }) => {
        expect(err.retryAfterSeconds).toBeGreaterThan(0);
      });
    });

    test("the state survives a reload (localStorage)", async () => {
      seedMockTwoFactor(true);
      expect(JSON.parse(localStorage.getItem("usdx-mock-two-factor") ?? "{}")).toMatchObject({
        enabled: true,
      });
    });
  });
});
