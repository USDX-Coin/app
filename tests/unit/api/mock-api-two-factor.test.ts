import { describe, test, expect, beforeEach } from "vitest";
import {
  isMockCurrentPassword,
  mockGetMe,
  mockLogin,
  mockVerifyTwoFactorLogin,
} from "@/lib/api/mock-api";
import {
  MOCK_BACKUP_CODES,
  MOCK_TOTP_CODE,
  resetMockTwoFactor,
  seedMockTwoFactor,
} from "@/lib/api/mock-two-factor";

// Mock login on an account with 2FA (auth.yaml § loginV2 + two-factor.yaml §
// verifyLogin, USDX-714): step 1 answers `{ twoFactorRequired: true }` with NO
// token, step 2 issues the session. The profile carries `twoFactorEnabled`.

const DEMO = { email: "demo@usdx.com", password: "Demo1234" };

beforeEach(() => {
  localStorage.clear();
  resetMockTwoFactor();
});

describe("mock login with 2FA", () => {
  describe("positive", () => {
    test("2FA off → a session straight away, profile says twoFactorEnabled false", async () => {
      const result = await mockLogin(DEMO);
      expect(result).toMatchObject({ token: expect.any(String) });
      expect("user" in result && result.user.twoFactorEnabled).toBe(false);
    });

    test("2FA on → twoFactorRequired without a token; the code issues the session", async () => {
      seedMockTwoFactor(true);

      const step1 = await mockLogin(DEMO);
      expect(step1).toEqual({ twoFactorRequired: true });

      const step2 = await mockVerifyTwoFactorLogin({ code: MOCK_TOTP_CODE });
      expect(step2.token).toEqual(expect.any(String));
      expect(step2.user.email).toBe(DEMO.email);
      expect(step2.user.twoFactorEnabled).toBe(true);
      await expect(mockGetMe()).resolves.toMatchObject({ email: DEMO.email, twoFactorEnabled: true });
    });

    test("a backup code also finishes the login", async () => {
      seedMockTwoFactor(true);
      await mockLogin(DEMO);
      await expect(mockVerifyTwoFactorLogin({ code: MOCK_BACKUP_CODES[2] })).resolves.toMatchObject({
        user: { email: DEMO.email },
      });
    });

    test("isMockCurrentPassword checks the logged-in account's password", async () => {
      await mockLogin(DEMO);
      expect(isMockCurrentPassword("Demo1234")).toBe(true);
      expect(isMockCurrentPassword("wrong")).toBe(false);
    });
  });

  describe("negative", () => {
    test("wrong password never reaches the 2FA step", async () => {
      seedMockTwoFactor(true);
      await expect(mockLogin({ ...DEMO, password: "nope" })).rejects.toMatchObject({
        status: 401,
        code: "INVALID_CREDENTIALS",
      });
    });

    test("a wrong code is refused and issues nothing", async () => {
      seedMockTwoFactor(true);
      await mockLogin(DEMO);
      await expect(mockVerifyTwoFactorLogin({ code: "000000" })).rejects.toMatchObject({
        status: 401,
        code: "INVALID_TWO_FACTOR_CODE",
      });
    });
  });

  describe("edge case", () => {
    test("verify-login without step 1 → TWO_FACTOR_CHALLENGE_EXPIRED", async () => {
      seedMockTwoFactor(true);
      await expect(mockVerifyTwoFactorLogin({ code: MOCK_TOTP_CODE })).rejects.toMatchObject({
        status: 401,
        code: "TWO_FACTOR_CHALLENGE_EXPIRED",
      });
    });
  });
});
