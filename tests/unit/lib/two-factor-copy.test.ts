import { describe, test, expect } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Copy 2FA web (USDX-714): lengkap di EN dan ID; peringatan kunci 24 jam
// (custodial-wallet.md §6.1 no.6) ada di dialog Matikan 2FA dan di pemulihan email;
// tanpa jargon teknis ("TOTP", "otpauth", "challenge", "custodial").
const PREFIXES = ["auth.2fa.", "settings.2fa.", "twoFactor."];
const JARGON = /totp|otpauth|challenge|custodial/i;

function keysOf(lang: "en" | "id") {
  return Object.keys(dictionaries[lang]).filter((k) => PREFIXES.some((p) => k.startsWith(p)));
}

describe("two-factor copy", () => {
  describe("positive", () => {
    test("every key exists in both languages", () => {
      expect(keysOf("en").sort()).toEqual(keysOf("id").sort());
      expect(keysOf("en").length).toBeGreaterThan(0);
    });

    test("every 24-hour hold warning says 24 in both languages", () => {
      for (const lang of ["en", "id"] as const) {
        expect(dictionaries[lang]["twoFactor.disable.warning"]).toMatch(/24/);
        expect(dictionaries[lang]["auth.2fa.recovery.lockWarning"]).toMatch(/24/);
        expect(dictionaries[lang]["twoFactor.regenerate.warning"]).toMatch(/24/);
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
  });

  describe("edge case", () => {
    test("no empty strings", () => {
      for (const lang of ["en", "id"] as const) {
        for (const key of keysOf(lang)) expect(dictionaries[lang][key].trim()).not.toBe("");
      }
    });
  });
});
