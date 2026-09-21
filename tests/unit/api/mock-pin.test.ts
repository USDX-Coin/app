import { describe, test, expect, beforeEach } from "vitest";
import {
  mockSetPin,
  mockChangePin,
  verifyMockPin,
  isMockPinSet,
  seedMockPin,
  resetMockPin,
  seedMockStrictPinSet,
  seedMockSessionFresh,
  markMockPasswordAuth,
  MOCK_PIN,
} from "@/lib/api/mock-pin";

// Mock layer for the account PIN (pin.yaml § set / change, USDX-651). The mock is
// the only backend the offline suites (Playwright) ever see, so its error
// precedence has to match the contract (pin.yaml § change "Urutan pemeriksaan"):
// shape first (422, no attempt burnt), then the shared `pin` lockout, then
// "has a PIN", then the comparison — and only then PIN_UNCHANGED.
const NEW_PIN = "654321";

beforeEach(() => {
  resetMockPin();
});

describe("mockSetPin", () => {
  describe("positive", () => {
    test("first-time set: an account without a PIN gets one and can use it right away", async () => {
      seedMockPin(null);
      expect(isMockPinSet()).toBe(false);

      await expect(mockSetPin({ pin: NEW_PIN })).resolves.toBeUndefined();

      expect(isMockPinSet()).toBe(true);
      expect(() => verifyMockPin(NEW_PIN)).not.toThrow();
    });

    test("overwriting an existing PIN with the correct currentPin replaces it", async () => {
      await mockSetPin({ pin: NEW_PIN, currentPin: MOCK_PIN });

      expect(() => verifyMockPin(NEW_PIN)).not.toThrow();
      expect(() => verifyMockPin(MOCK_PIN)).toThrow(expect.objectContaining({ code: "INVALID_PIN" }));
    });
  });

  describe("negative", () => {
    test("overwriting an existing PIN without currentPin → 401 REAUTH_REQUIRED, PIN unchanged", async () => {
      await expect(mockSetPin({ pin: NEW_PIN })).rejects.toMatchObject({
        status: 401,
        code: "REAUTH_REQUIRED",
      });
      expect(() => verifyMockPin(MOCK_PIN)).not.toThrow();
    });

    test("wrong currentPin → 401 INVALID_PIN and the attempt counts toward the shared lockout", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(mockSetPin({ pin: NEW_PIN, currentPin: "000000" })).rejects.toMatchObject({
          status: 401,
          code: "INVALID_PIN",
        });
      }
      // The sixth try is locked out even with the right current PIN.
      await expect(mockSetPin({ pin: NEW_PIN, currentPin: MOCK_PIN })).rejects.toMatchObject({
        status: 429,
        code: "TOO_MANY_ATTEMPTS",
        retryAfterSeconds: 900,
      });
      expect(() => verifyMockPin(MOCK_PIN)).toThrow(expect.objectContaining({ code: "TOO_MANY_ATTEMPTS" }));
    });

    test("a malformed pin → 422 VALIDATION_ERROR without burning an attempt", async () => {
      await expect(mockSetPin({ pin: "12345" })).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
      await expect(mockSetPin({ pin: "abcdef" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      // No attempt was counted: five wrong currentPins are still available.
      for (let i = 0; i < 5; i++) {
        await expect(mockSetPin({ pin: NEW_PIN, currentPin: "000000" })).rejects.toMatchObject({
          code: "INVALID_PIN",
        });
      }
    });
  });

  describe("edge case", () => {
    test("first-time set ignores currentPin, even a wrong one (pin.yaml: session-only)", async () => {
      seedMockPin(null);
      await expect(mockSetPin({ pin: NEW_PIN, currentPin: "000000" })).resolves.toBeUndefined();
      expect(() => verifyMockPin(NEW_PIN)).not.toThrow();
    });

    test("a successful set resets the lockout counter", async () => {
      for (let i = 0; i < 4; i++) {
        await expect(mockSetPin({ pin: NEW_PIN, currentPin: "000000" })).rejects.toMatchObject({
          code: "INVALID_PIN",
        });
      }
      await mockSetPin({ pin: NEW_PIN, currentPin: MOCK_PIN });
      // Four fresh wrong attempts are allowed again — the counter started over.
      for (let i = 0; i < 4; i++) {
        expect(() => verifyMockPin("000000")).toThrow(expect.objectContaining({ code: "INVALID_PIN" }));
      }
      expect(() => verifyMockPin(NEW_PIN)).not.toThrow();
    });
  });
});

describe("mockChangePin", () => {
  describe("positive", () => {
    test("correct current PIN → the new PIN works and the old one does not", async () => {
      await expect(mockChangePin({ currentPin: MOCK_PIN, newPin: NEW_PIN })).resolves.toBeUndefined();

      expect(() => verifyMockPin(NEW_PIN)).not.toThrow();
      expect(() => verifyMockPin(MOCK_PIN)).toThrow(expect.objectContaining({ code: "INVALID_PIN" }));
    });
  });

  describe("negative", () => {
    test("wrong current PIN → 401 INVALID_PIN, nothing changes", async () => {
      await expect(mockChangePin({ currentPin: "000000", newPin: NEW_PIN })).rejects.toMatchObject({
        status: 401,
        code: "INVALID_PIN",
      });
      expect(() => verifyMockPin(MOCK_PIN)).not.toThrow();
    });

    test("no PIN on the account → 401 PIN_NOT_SET", async () => {
      seedMockPin(null);
      await expect(mockChangePin({ currentPin: MOCK_PIN, newPin: NEW_PIN })).rejects.toMatchObject({
        status: 401,
        code: "PIN_NOT_SET",
      });
    });

    test("newPin equal to a correct currentPin → 422 PIN_UNCHANGED, nothing changes", async () => {
      await expect(mockChangePin({ currentPin: MOCK_PIN, newPin: MOCK_PIN })).rejects.toMatchObject({
        status: 422,
        code: "PIN_UNCHANGED",
      });
      expect(() => verifyMockPin(MOCK_PIN)).not.toThrow();
    });

    test("wrong currentPin + the same newPin → 401 INVALID_PIN and the attempt is burnt (PIN is checked first)", async () => {
      // pin.yaml § change "Urutan pemeriksaan": PIN_UNCHANGED only ever follows a
      // CORRECT currentPin (PinService, backend dev@d2224818).
      for (let i = 0; i < 5; i++) {
        await expect(mockChangePin({ currentPin: "000000", newPin: "000000" })).rejects.toMatchObject({
          status: 401,
          code: "INVALID_PIN",
        });
      }
      expect(() => verifyMockPin(MOCK_PIN)).toThrow(expect.objectContaining({ code: "TOO_MANY_ATTEMPTS" }));
    });

    test("malformed PINs → 422 VALIDATION_ERROR", async () => {
      await expect(mockChangePin({ currentPin: "12", newPin: NEW_PIN })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
      await expect(mockChangePin({ currentPin: MOCK_PIN, newPin: "12345a" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("edge case", () => {
    test("the lockout answers before PIN_NOT_SET (order: lockout → PIN_NOT_SET → INVALID_PIN)", async () => {
      for (let i = 0; i < 5; i++) {
        expect(() => verifyMockPin("000000")).toThrow(expect.objectContaining({ code: "INVALID_PIN" }));
      }
      seedMockPin(null); // the PIN is gone, the lockout is not
      expect(() => verifyMockPin(MOCK_PIN)).toThrow(expect.objectContaining({ code: "TOO_MANY_ATTEMPTS" }));
      await expect(mockChangePin({ currentPin: MOCK_PIN, newPin: NEW_PIN })).rejects.toMatchObject({
        status: 429,
        code: "TOO_MANY_ATTEMPTS",
      });
    });

    test("the lockout is shared: wrong attempts on change lock the transfer/redeem verification too", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(mockChangePin({ currentPin: "000000", newPin: NEW_PIN })).rejects.toMatchObject({
          code: "INVALID_PIN",
        });
      }
      await expect(mockChangePin({ currentPin: MOCK_PIN, newPin: NEW_PIN })).rejects.toMatchObject({
        status: 429,
        code: "TOO_MANY_ATTEMPTS",
        retryAfterSeconds: 900,
      });
      expect(() => verifyMockPin(MOCK_PIN)).toThrow(expect.objectContaining({ code: "TOO_MANY_ATTEMPTS" }));
    });
  });
});

// Seam gerbang USDX-698 (pin.yaml § set, keputusan PM 21 Sep 2026; USDX-697):
// first-time set di akun ber-wallet custodial wajib sesi password-auth segar
// (< 5 menit). Mati secara bawaan = backend yang hidup hari ini (session-only),
// jadi semua spec lama tidak berubah. Nyala = backend sesudah 698.
describe("mockSetPin — strict first-time set (backend USDX-698 seam)", () => {
  const WALLET = { hasCustodialWallet: true };

  beforeEach(() => {
    seedMockPin(null);
    seedMockStrictPinSet(true);
  });

  describe("positive", () => {
    test("wallet + no PIN + fresh session → the PIN is created", async () => {
      seedMockSessionFresh(true);
      await expect(mockSetPin({ pin: NEW_PIN }, WALLET)).resolves.toBeUndefined();
      expect(() => verifyMockPin(NEW_PIN)).not.toThrow();
    });

    test("a login (password auth) makes the session fresh", async () => {
      markMockPasswordAuth();
      await expect(mockSetPin({ pin: NEW_PIN }, WALLET)).resolves.toBeUndefined();
    });

    test("no custodial wallet → session-only as before, even when the session is stale", async () => {
      seedMockSessionFresh(false);
      await expect(mockSetPin({ pin: NEW_PIN }, { hasCustodialWallet: false })).resolves.toBeUndefined();
    });
  });

  describe("negative", () => {
    test("wallet + no PIN + stale session → 401 REAUTH_REQUIRED with details.pinSet false; nothing is set", async () => {
      seedMockSessionFresh(false);
      await expect(mockSetPin({ pin: NEW_PIN }, WALLET)).rejects.toMatchObject({
        status: 401,
        code: "REAUTH_REQUIRED",
        details: { pinSet: false },
      });
      expect(isMockPinSet()).toBe(false);
    });

    test("a currentPin cannot stand in for the fresh session (there is no PIN to prove)", async () => {
      seedMockSessionFresh(false);
      await expect(mockSetPin({ pin: NEW_PIN, currentPin: MOCK_PIN }, WALLET)).rejects.toMatchObject({
        code: "REAUTH_REQUIRED",
        details: { pinSet: false },
      });
    });

    test("overwriting an existing PIN without currentPin on a stale session → REAUTH_REQUIRED with details.pinSet true", async () => {
      seedMockPin(MOCK_PIN);
      seedMockSessionFresh(false);
      await expect(mockSetPin({ pin: NEW_PIN }, WALLET)).rejects.toMatchObject({
        code: "REAUTH_REQUIRED",
        details: { pinSet: true },
      });
    });
  });

  describe("edge case", () => {
    test("a password auth older than 5 minutes is stale", async () => {
      markMockPasswordAuth(Date.now() - 5 * 60 * 1000 - 1);
      await expect(mockSetPin({ pin: NEW_PIN }, WALLET)).rejects.toMatchObject({ code: "REAUTH_REQUIRED" });
    });

    test("seam off (default) → the old backend: wallet + stale session still sets, overwrite REAUTH carries no details", async () => {
      seedMockStrictPinSet(false);
      seedMockSessionFresh(false);
      await expect(mockSetPin({ pin: NEW_PIN }, WALLET)).resolves.toBeUndefined();
      const err = await mockSetPin({ pin: "111111" }, WALLET).catch((e: unknown) => e);
      expect(err).toMatchObject({ code: "REAUTH_REQUIRED", details: undefined });
    });

    test("resetMockPin switches the seam off and forgets the session age", async () => {
      markMockPasswordAuth();
      resetMockPin();
      seedMockPin(null);
      await expect(mockSetPin({ pin: NEW_PIN }, WALLET)).resolves.toBeUndefined();
    });
  });
});
