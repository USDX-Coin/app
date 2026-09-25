import { describe, test, expect } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Copy 2FA di transfer & redeem custodial (custodial-wallet.md §6.1, USDX-717):
// lengkap di EN dan ID, tanpa jargon ("TOTP", "custodial", "step-up"), dan kalimat
// terkunci kode authenticator BERBEDA dari PIN terkunci (AC: user tahu yang mana).
const PREFIX = "stepUp.";
const JARGON = /totp|custodial|step-?up|idempotency/i;

function keysOf(lang: "en" | "id") {
  return Object.keys(dictionaries[lang]).filter((k) => k.startsWith(PREFIX));
}

describe("step-up copy", () => {
  describe("positive", () => {
    test("every key exists in both languages", () => {
      expect(keysOf("en").sort()).toEqual(keysOf("id").sort());
      expect(keysOf("en").length).toBeGreaterThan(0);
    });

    test("wrong code says the authenticator code is wrong (ticket wording)", () => {
      expect(dictionaries.id["stepUp.errInvalid"]).toMatch(/^Kode authenticator salah/);
      expect(dictionaries.en["stepUp.errInvalid"]).toMatch(/authenticator code is wrong/i);
    });

    test("the lock banner and the lockout carry their time placeholder", () => {
      for (const lang of ["en", "id"] as const) {
        expect(dictionaries[lang]["stepUp.locked"]).toContain("{time}");
        expect(dictionaries[lang]["stepUp.errLocked"]).toContain("{time}");
      }
    });
  });

  describe("negative", () => {
    test("no technical jargon on screen", () => {
      for (const lang of ["en", "id"] as const) {
        for (const key of keysOf(lang)) {
          expect(dictionaries[lang][key], `${lang} ${key}`).not.toMatch(JARGON);
        }
      }
    });

    test("the 2FA lockout sentence is not the PIN lockout sentence", () => {
      for (const lang of ["en", "id"] as const) {
        expect(dictionaries[lang]["stepUp.errLocked"]).not.toBe(dictionaries[lang]["pin.errLocked"]);
      }
    });
  });

  describe("edge case", () => {
    test("no empty strings", () => {
      for (const lang of ["en", "id"] as const) {
        for (const key of keysOf(lang)) expect(dictionaries[lang][key].trim()).not.toBe("");
      }
    });
  });
});
