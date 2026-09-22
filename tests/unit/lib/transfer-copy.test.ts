import { describe, test, expect } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Copy tracker + riwayat transfer (USDX-701): lengkap di EN dan ID, dan tanpa jargon
// — "custodial", "nonce", "receipt", "revert" tidak boleh muncul di layar.
const PREFIXES = [
  "transfer.status.",
  "transfer.tracker.",
  "transfer.failure.",
  "transfer.history.",
  "transfer.detail.",
];
const JARGON = /custodial|nonce|receipt|revert/i;

function keysOf(lang: "en" | "id") {
  return Object.keys(dictionaries[lang]).filter((k) => PREFIXES.some((p) => k.startsWith(p)));
}

describe("transfer tracker/history copy", () => {
  describe("positive", () => {
    test("every key exists in both languages", () => {
      expect(keysOf("en").sort()).toEqual(keysOf("id").sort());
      expect(keysOf("en").length).toBeGreaterThan(0);
    });

    test("each status and failure reason has a label", () => {
      for (const lang of ["en", "id"] as const) {
        for (const k of [
          "transfer.status.PENDING",
          "transfer.status.CONFIRMED",
          "transfer.status.FAILED",
          "transfer.failure.REVERTED",
          "transfer.failure.DROPPED",
        ]) {
          expect(dictionaries[lang][k], `${lang} ${k}`).toBeTruthy();
        }
      }
    });
  });

  describe("negative", () => {
    test("no sentence uses custodial / nonce / receipt / revert", () => {
      for (const lang of ["en", "id"] as const) {
        for (const k of keysOf(lang)) {
          expect(dictionaries[lang][k], `${lang} ${k}`).not.toMatch(JARGON);
        }
      }
    });
  });

  describe("edge case", () => {
    test("nothing before CONFIRMED says successful / berhasil", () => {
      for (const lang of ["en", "id"] as const) {
        for (const k of ["transfer.status.PENDING", "transfer.tracker.pendingTitle", "transfer.tracker.pendingDesc"]) {
          expect(dictionaries[lang][k], `${lang} ${k}`).not.toMatch(/success|berhasil/i);
        }
      }
    });
  });
});
