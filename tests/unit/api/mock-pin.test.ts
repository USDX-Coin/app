import { describe, test, expect, beforeEach } from "vitest";
import {
  mockSetPin,
  mockChangePin,
  verifyMockPin,
  isMockPinSet,
  seedMockPin,
  resetMockPin,
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
