import { describe, test, expect } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  isTwoFactorSetupRequired,
  isTwoFactorCodeRequired,
  isCustodialOutboundLocked,
  getOutboundLockedUntil,
  getLockoutScope,
} from "@/lib/api/errors";

// Kode error 2FA uang keluar custodial (wallet.yaml / redeem.yaml, custodial-wallet.md
// §6.1, USDX-717). Status DAN code dicocokkan: ketiga 401 ini bukan sesi kedaluwarsa,
// dan 409 beririsan dengan WALLET_NOT_ACTIVE / IDEMPOTENCY_KEY_*.
describe("errors helpers — 2FA step-up custodial", () => {
  describe("positive", () => {
    test("isTwoFactorSetupRequired matches 401 TWO_FACTOR_SETUP_REQUIRED", () => {
      expect(isTwoFactorSetupRequired(new ApiError(401, "TWO_FACTOR_SETUP_REQUIRED", "x"))).toBe(true);
    });

    test("isTwoFactorCodeRequired matches 401 TWO_FACTOR_CODE_REQUIRED", () => {
      expect(isTwoFactorCodeRequired(new ApiError(401, "TWO_FACTOR_CODE_REQUIRED", "x"))).toBe(true);
    });

    test("isCustodialOutboundLocked matches 409 CUSTODIAL_OUTBOUND_LOCKED", () => {
      expect(isCustodialOutboundLocked(new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x"))).toBe(true);
    });

    test("getOutboundLockedUntil reads details.lockedUntil", () => {
      const err = new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x", {
        lockedUntil: "2026-09-26T10:00:00.000Z",
      });
      expect(getOutboundLockedUntil(err)).toBe("2026-09-26T10:00:00.000Z");
    });

    test("getLockoutScope reads details.scope of 429 TOO_MANY_ATTEMPTS (pin | 2fa-stepup)", () => {
      const pin = new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "pin" }, 900);
      const stepUp = new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "2fa-stepup" }, 900);
      expect(getLockoutScope(pin)).toBe("pin");
      expect(getLockoutScope(stepUp)).toBe("2fa-stepup");
    });
  });

  describe("negative", () => {
    test("the 401 helpers do not match each other nor a dead session", () => {
      expect(isTwoFactorSetupRequired(new ApiError(401, "TWO_FACTOR_CODE_REQUIRED", "x"))).toBe(false);
      expect(isTwoFactorCodeRequired(new ApiError(401, "TWO_FACTOR_SETUP_REQUIRED", "x"))).toBe(false);
      expect(isTwoFactorSetupRequired(new ApiError(401, "UNAUTHORIZED", "x"))).toBe(false);
    });

    test("isCustodialOutboundLocked does not match the other 409s", () => {
      expect(isCustodialOutboundLocked(new ApiError(409, "WALLET_NOT_ACTIVE", "x"))).toBe(false);
      expect(isCustodialOutboundLocked(new ApiError(409, "IDEMPOTENCY_KEY_IN_PROGRESS", "x"))).toBe(false);
    });

    test("getOutboundLockedUntil / getLockoutScope are null for other errors", () => {
      expect(getOutboundLockedUntil(new ApiError(409, "WALLET_NOT_ACTIVE", "x", { lockedUntil: "z" }))).toBeNull();
      expect(getLockoutScope(new ApiError(429, "RATE_LIMITED", "x", { scope: "pin" }))).toBeNull();
      expect(getLockoutScope(new Error("boom"))).toBeNull();
    });
  });

  describe("edge case", () => {
    test("getLockoutScope is null when scope is absent (backend before USDX-718) or unknown", () => {
      expect(getLockoutScope(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }))).toBeNull();
      expect(getLockoutScope(new ApiError(429, "TOO_MANY_ATTEMPTS", "x"))).toBeNull();
      expect(getLockoutScope(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "2fa-verify" }))).toBeNull();
    });

    test("getOutboundLockedUntil is null when details has no string lockedUntil", () => {
      expect(getOutboundLockedUntil(new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x"))).toBeNull();
      expect(
        getOutboundLockedUntil(new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x", { lockedUntil: 42 })),
      ).toBeNull();
    });
  });
});
