import { describe, test, expect, beforeEach } from "vitest";
import { mockCreateRedeemOrder } from "@/lib/api/mock-api";
import {
  mockGetCustodialWallet,
  mockTransferCustodial,
  resetMockCustodialWallet,
  seedMockCustodialWallet,
  MOCK_CUSTODIAL_ADDRESS,
} from "@/lib/api/mock-custodial-wallet";
import { MOCK_PIN } from "@/lib/api/mock-pin";
import {
  MOCK_BACKUP_CODES,
  MOCK_TOTP_CODE,
  resetMockTwoFactor,
  seedMockLegacyStepUp,
  seedMockOutboundLock,
  seedMockTwoFactor,
} from "@/lib/api/mock-two-factor";

// The mock transfer / redeem custodial play backend USDX-718 (custodial-wallet.md
// §6.1): PIN → 2FA → (transfer: replay) → 24-hour lock → the rest. The legacy seam
// plays the backend BEFORE 718, which drops `twoFactorCode` silently — the release
// order (FE first) depends on that.
const TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const KEY = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf1";
const KEY_2 = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf2";
const transfer = { to: TO, amount: "25", pin: MOCK_PIN, twoFactorCode: MOCK_TOTP_CODE };
const redeem = {
  amount: "100",
  amountCurrency: "USD" as const,
  chain: "polygon",
  bankCode: "014",
  bankAccountNumber: "1234563210",
  bankAccountName: "SINGGIH BRILIAN TARA",
  userAddress: MOCK_CUSTODIAL_ADDRESS,
  pin: MOCK_PIN,
  twoFactorCode: MOCK_TOTP_CODE,
};
const LOCKED_UNTIL = new Date(Date.now() + 3_600_000).toISOString();

beforeEach(() => {
  localStorage.clear();
  resetMockCustodialWallet();
  resetMockTwoFactor();
  seedMockCustodialWallet();
  seedMockTwoFactor(true);
});

describe("mock custodial money out — 2FA step-up", () => {
  describe("positive", () => {
    test("transfer and redeem go through with PIN + authenticator code", async () => {
      await expect(mockTransferCustodial(transfer, KEY)).resolves.toMatchObject({ to: TO });
      await expect(mockCreateRedeemOrder(redeem)).resolves.toMatchObject({ burnMode: "CUSTODIAL" });
    });

    test("a backup code approves one transfer", async () => {
      await expect(
        mockTransferCustodial({ ...transfer, twoFactorCode: MOCK_BACKUP_CODES[0] }, KEY),
      ).resolves.toMatchObject({ to: TO });
    });

    test("GET /wallet carries outboundLockedUntil (null when not locked)", async () => {
      expect((await mockGetCustodialWallet()).outboundLockedUntil).toBeNull();
      seedMockOutboundLock(LOCKED_UNTIL);
      expect((await mockGetCustodialWallet()).outboundLockedUntil).toBe(LOCKED_UNTIL);
    });
  });

  describe("negative", () => {
    test("2FA off → 401 TWO_FACTOR_SETUP_REQUIRED on both paths", async () => {
      seedMockTwoFactor(false);
      await expect(mockTransferCustodial(transfer, KEY)).rejects.toMatchObject({
        status: 401,
        code: "TWO_FACTOR_SETUP_REQUIRED",
      });
      await expect(mockCreateRedeemOrder(redeem)).rejects.toMatchObject({
        code: "TWO_FACTOR_SETUP_REQUIRED",
      });
    });

    test("no code → TWO_FACTOR_CODE_REQUIRED; wrong code → INVALID_TWO_FACTOR_CODE", async () => {
      await expect(
        mockTransferCustodial({ ...transfer, twoFactorCode: undefined }, KEY),
      ).rejects.toMatchObject({ code: "TWO_FACTOR_CODE_REQUIRED" });
      await expect(
        mockCreateRedeemOrder({ ...redeem, twoFactorCode: "000000" }),
      ).rejects.toMatchObject({ status: 401, code: "INVALID_TWO_FACTOR_CODE" });
    });

    test("locked → 409 CUSTODIAL_OUTBOUND_LOCKED + details.lockedUntil on both paths", async () => {
      seedMockOutboundLock(LOCKED_UNTIL);
      const locked = { status: 409, code: "CUSTODIAL_OUTBOUND_LOCKED", details: { lockedUntil: LOCKED_UNTIL } };
      await expect(mockTransferCustodial(transfer, KEY)).rejects.toMatchObject(locked);
      await expect(mockCreateRedeemOrder(redeem)).rejects.toMatchObject(locked);
    });
  });

  describe("edge case", () => {
    test("a wrong PIN never checks the code (PIN first)", async () => {
      await expect(
        mockTransferCustodial({ ...transfer, pin: "000000", twoFactorCode: "000000" }, KEY),
      ).rejects.toMatchObject({ code: "INVALID_PIN" });
    });

    test("PIN lockout carries details.scope pin; 2FA lockout carries 2fa-stepup", async () => {
      for (let i = 0; i < 5; i++) {
        await mockTransferCustodial({ ...transfer, twoFactorCode: "000000" }, KEY).catch(() => {});
      }
      await expect(mockTransferCustodial(transfer, KEY)).rejects.toMatchObject({
        status: 429,
        details: { scope: "2fa-stepup" },
      });
      for (let i = 0; i < 5; i++) {
        await mockTransferCustodial({ ...transfer, pin: "000000" }, KEY_2).catch(() => {});
      }
      await expect(mockTransferCustodial(transfer, KEY_2)).rejects.toMatchObject({
        status: 429,
        details: { scope: "pin" },
      });
    });

    test("a replay with the same key is answered before the lock", async () => {
      const first = await mockTransferCustodial(transfer, KEY);
      seedMockOutboundLock(LOCKED_UNTIL);
      await expect(mockTransferCustodial(transfer, KEY)).resolves.toEqual(first);
    });

    test("legacy backend (before USDX-718): twoFactorCode dropped, no 2FA, no lock, no field", async () => {
      seedMockLegacyStepUp(true);
      seedMockTwoFactor(false);
      seedMockOutboundLock(LOCKED_UNTIL);
      await expect(mockTransferCustodial(transfer, KEY)).resolves.toMatchObject({ to: TO });
      await expect(mockCreateRedeemOrder(redeem)).resolves.toMatchObject({ burnMode: "CUSTODIAL" });
      expect((await mockGetCustodialWallet()).outboundLockedUntil).toBeUndefined();
    });
  });
});
