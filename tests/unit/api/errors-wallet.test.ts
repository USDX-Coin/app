import { describe, test, expect } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  isWalletNotFound,
  isWalletTransferNotFound,
  isWalletNotActive,
  isWalletServiceUnavailable,
  isNetworkCongested,
  isInvalidPin,
  isPinNotSet,
  isTooManyAttempts,
  isReauthRequired,
  isPinUnchanged,
  isIdempotencyKeyInProgress,
  isIdempotencyKeyReused,
  isRecipientBlacklisted,
  isTransferLimitExceeded,
  getTransferLimitDetails,
  getReauthPinSet,
} from "@/lib/api/errors";

// Helper error-code wallet custodial (wallet.yaml § PETA KODE 409, USDX-567).
// Setiap helper mencocokkan status DAN code: tiga kondisi 409 beririsan, dan
// 401 INVALID_PIN bukan 401 sesi kedaluwarsa.
describe("errors helpers — wallet custodial", () => {
  describe("positive", () => {
    test("isWalletNotFound matches 404 WALLET_NOT_FOUND", () => {
      expect(isWalletNotFound(new ApiError(404, "WALLET_NOT_FOUND", "x"))).toBe(true);
    });

    test("isWalletTransferNotFound matches 404 WALLET_TRANSFER_NOT_FOUND (USDX-701)", () => {
      expect(
        isWalletTransferNotFound(new ApiError(404, "WALLET_TRANSFER_NOT_FOUND", "x")),
      ).toBe(true);
    });

    test("isWalletNotActive matches 409 WALLET_NOT_ACTIVE", () => {
      expect(isWalletNotActive(new ApiError(409, "WALLET_NOT_ACTIVE", "x"))).toBe(true);
    });

    test("isWalletServiceUnavailable matches 503 WALLET_SERVICE_UNAVAILABLE", () => {
      expect(
        isWalletServiceUnavailable(new ApiError(503, "WALLET_SERVICE_UNAVAILABLE", "x")),
      ).toBe(true);
    });

    test("isNetworkCongested matches 503 NETWORK_CONGESTED (USDX-709)", () => {
      expect(isNetworkCongested(new ApiError(503, "NETWORK_CONGESTED", "x"))).toBe(true);
    });

    test("PIN helpers tell INVALID_PIN, PIN_NOT_SET and TOO_MANY_ATTEMPTS apart", () => {
      expect(isInvalidPin(new ApiError(401, "INVALID_PIN", "x"))).toBe(true);
      expect(isPinNotSet(new ApiError(401, "PIN_NOT_SET", "x"))).toBe(true);
      expect(isTooManyAttempts(new ApiError(429, "TOO_MANY_ATTEMPTS", "x"))).toBe(true);
      expect(isInvalidPin(new ApiError(401, "PIN_NOT_SET", "x"))).toBe(false);
      expect(isPinNotSet(new ApiError(401, "INVALID_PIN", "x"))).toBe(false);
    });

    test("PIN set/change helpers (USDX-651): REAUTH_REQUIRED is a 401 that is not a dead session; PIN_UNCHANGED is a 422 that is not VALIDATION_ERROR", () => {
      expect(isReauthRequired(new ApiError(401, "REAUTH_REQUIRED", "x"))).toBe(true);
      expect(isReauthRequired(new ApiError(401, "INVALID_PIN", "x"))).toBe(false);
      expect(isReauthRequired(new ApiError(401, "UNAUTHORIZED", "x"))).toBe(false);
      expect(isPinUnchanged(new ApiError(422, "PIN_UNCHANGED", "x"))).toBe(true);
      expect(isPinUnchanged(new ApiError(422, "VALIDATION_ERROR", "x"))).toBe(false);
    });

    test("idempotency helpers branch on code, not status", () => {
      const inProgress = new ApiError(409, "IDEMPOTENCY_KEY_IN_PROGRESS", "x");
      const reused = new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "x");
      expect(isIdempotencyKeyInProgress(inProgress)).toBe(true);
      expect(isIdempotencyKeyInProgress(reused)).toBe(false);
      expect(isIdempotencyKeyReused(reused)).toBe(true);
      expect(isIdempotencyKeyReused(inProgress)).toBe(false);
      // WALLET_NOT_ACTIVE shares the status and must not match either.
      expect(isIdempotencyKeyInProgress(new ApiError(409, "WALLET_NOT_ACTIVE", "x"))).toBe(false);
    });

    test("isRecipientBlacklisted matches 422 RECIPIENT_BLACKLISTED", () => {
      expect(isRecipientBlacklisted(new ApiError(422, "RECIPIENT_BLACKLISTED", "x"))).toBe(true);
    });

    test("getTransferLimitDetails reads the contract details", () => {
      const err = new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "x", {
        limitType: "DAILY",
        limit: "5000.00",
        remaining: "120.00",
        resetAt: "2026-08-29T00:00:00.000Z",
      });
      expect(isTransferLimitExceeded(err)).toBe(true);
      expect(getTransferLimitDetails(err)).toEqual({
        limitType: "DAILY",
        limit: "5000.00",
        remaining: "120.00",
        resetAt: "2026-08-29T00:00:00.000Z",
      });
    });
  });

  describe("negative", () => {
    test("a non-ApiError never matches", () => {
      expect(isWalletNotActive(new Error("boom"))).toBe(false);
      expect(isInvalidPin(undefined)).toBe(false);
      expect(getTransferLimitDetails(new Error("boom"))).toBeNull();
    });

    test("the two 404s are told apart: WALLET_NOT_FOUND ≠ WALLET_TRANSFER_NOT_FOUND", () => {
      expect(isWalletTransferNotFound(new ApiError(404, "WALLET_NOT_FOUND", "x"))).toBe(false);
      expect(isWalletNotFound(new ApiError(404, "WALLET_TRANSFER_NOT_FOUND", "x"))).toBe(false);
    });

    test("isTooManyAttempts does not match RATE_LIMITED (throughput throttle)", () => {
      expect(isTooManyAttempts(new ApiError(429, "RATE_LIMITED", "x"))).toBe(false);
    });

    test("isInvalidPin does not match a 401 session error", () => {
      expect(isInvalidPin(new ApiError(401, "UNAUTHORIZED", "x"))).toBe(false);
    });

    test("the two 503s are told apart: NETWORK_CONGESTED ≠ WALLET_SERVICE_UNAVAILABLE", () => {
      expect(isNetworkCongested(new ApiError(503, "WALLET_SERVICE_UNAVAILABLE", "x"))).toBe(false);
      expect(isWalletServiceUnavailable(new ApiError(503, "NETWORK_CONGESTED", "x"))).toBe(false);
      // Same code on another status is not the contract's 503.
      expect(isNetworkCongested(new ApiError(500, "NETWORK_CONGESTED", "x"))).toBe(false);
    });
  });

  describe("edge case", () => {
    test("getTransferLimitDetails is null when details are malformed", () => {
      expect(getTransferLimitDetails(new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "x"))).toBeNull();
      expect(
        getTransferLimitDetails(
          new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "x", { limitType: "WEEKLY", limit: "1" }),
        ),
      ).toBeNull();
    });

    test("PER_TX has no resetAt — reported as null, not undefined", () => {
      const err = new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "x", {
        limitType: "PER_TX",
        limit: "1000.00",
        remaining: "1000.00",
        resetAt: null,
      });
      expect(getTransferLimitDetails(err)?.resetAt).toBeNull();
    });
  });
});

// `details.pinSet` pada 401 REAUTH_REQUIRED dari POST /auth/pin/set (pin.yaml
// § set, additive 21 Sep 2026; USDX-697). `false` = akun ber-wallet custodial
// yang BELUM punya PIN dan sesinya tidak segar; `true` / absen (backend lama) =
// akun sudah punya PIN. Klien tidak boleh menyimpulkan "sudah punya PIN" dari
// kode saja.
describe("getReauthPinSet", () => {
  describe("positive", () => {
    test("details.pinSet false → false (no PIN yet, the session is not fresh)", () => {
      expect(getReauthPinSet(new ApiError(401, "REAUTH_REQUIRED", "x", { pinSet: false }))).toBe(false);
    });

    test("details.pinSet true → true (the account already has a PIN)", () => {
      expect(getReauthPinSet(new ApiError(401, "REAUTH_REQUIRED", "x", { pinSet: true }))).toBe(true);
    });
  });

  describe("negative", () => {
    test("anything that is not REAUTH_REQUIRED → null", () => {
      expect(getReauthPinSet(new ApiError(401, "PIN_NOT_SET", "x", { pinSet: false }))).toBeNull();
      expect(getReauthPinSet(new ApiError(401, "INVALID_PIN", "x"))).toBeNull();
      expect(getReauthPinSet(new Error("boom"))).toBeNull();
      expect(getReauthPinSet(undefined)).toBeNull();
    });
  });

  describe("edge case", () => {
    test("details absent (old backend) → true, as the contract says", () => {
      expect(getReauthPinSet(new ApiError(401, "REAUTH_REQUIRED", "x"))).toBe(true);
      expect(getReauthPinSet(new ApiError(401, "REAUTH_REQUIRED", "x", {}))).toBe(true);
    });

    test("a pinSet that is not a boolean is read as true — only an explicit false means no PIN", () => {
      expect(getReauthPinSet(new ApiError(401, "REAUTH_REQUIRED", "x", { pinSet: "false" }))).toBe(true);
      expect(getReauthPinSet(new ApiError(401, "REAUTH_REQUIRED", "x", { pinSet: null }))).toBe(true);
      expect(getReauthPinSet(new ApiError(401, "REAUTH_REQUIRED", "x", "pinSet"))).toBe(true);
    });
  });
});
