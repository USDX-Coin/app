import { describe, test, expect } from "vitest";
import { validateTransferAddress, validateTransferAmount } from "@/lib/validations";

const OWN = "0x000000C528aE908fB929a0898B65e913623c9aFf";
const OTHER = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

describe("validateTransferAddress", () => {
  describe("positive", () => {
    test("accepts a valid EVM address that is not the user's own wallet", () => {
      expect(validateTransferAddress(OTHER, OWN)).toBeNull();
      expect(validateTransferAddress(OTHER, null)).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects the user's own custodial address, case-insensitively", () => {
      expect(validateTransferAddress(OWN.toLowerCase(), OWN)).toBe("validation.address.own");
    });

    test("rejects a Solana-shaped address — transfer is Polygon-only", () => {
      expect(validateTransferAddress("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T", OWN)).toBe(
        "validation.address.evmOnly",
      );
    });

    test("delegates EVM shape errors", () => {
      expect(validateTransferAddress("0x1234", OWN)).toBe("validation.address.evmLength");
      expect(validateTransferAddress("", OWN)).toBe("validation.address.required");
    });
  });

  describe("edge cases", () => {
    test("uppercase hex is a valid EVM address", () => {
      expect(validateTransferAddress("0x" + "AB".repeat(20), OWN)).toBeNull();
    });

    test("without a known own address the self-transfer rule cannot fire", () => {
      expect(validateTransferAddress(OWN, undefined)).toBeNull();
    });
  });
});

describe("validateTransferAmount", () => {
  describe("positive", () => {
    test("accepts positive decimals up to 6 places within the known balance", () => {
      expect(validateTransferAmount("25", 100)).toBeNull();
      expect(validateTransferAmount("0.000001", 100)).toBeNull();
      expect(validateTransferAmount("100", 100)).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects empty, non-numeric, zero, negative", () => {
      expect(validateTransferAmount("", 100)).toBe("validation.amount.required");
      expect(validateTransferAmount("abc", 100)).toBe("validation.amount.invalid");
      expect(validateTransferAmount("0", 100)).toBe("validation.amount.positive");
      expect(validateTransferAmount("-5", 100)).toBe("validation.amount.invalid");
    });

    test("rejects more than 6 decimals", () => {
      expect(validateTransferAmount("1.1234567", 100)).toBe("validation.amount.decimals");
    });

    test("rejects an amount above the KNOWN balance", () => {
      expect(validateTransferAmount("100.01", 100)).toBe("validation.amount.insufficient");
    });
  });

  describe("edge cases", () => {
    test("an unknown balance (null) never blocks — it is not zero", () => {
      expect(validateTransferAmount("25", null)).toBeNull();
      expect(validateTransferAmount("25", undefined)).toBeNull();
    });

    test("a lone dot is invalid, a trailing dot is fine while typing", () => {
      expect(validateTransferAmount(".", 100)).toBe("validation.amount.invalid");
      expect(validateTransferAmount("25.", 100)).toBeNull();
    });
  });
});
