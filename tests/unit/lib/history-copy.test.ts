import { describe, test, expect } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Copy riwayat terpadu /history (USDX-713, custodial-wallet.md §5.7): tab Masuk/Keluar,
// arah + pihak lain di baris transfer, dan empty state tab Semua yang umum.
const KEYS = ["tx.transferIn", "tx.transferOut", "tx.from", "tx.to", "tx.transferDetail"];

describe("unified history copy", () => {
  describe("positive", () => {
    test("every new key exists in both languages", () => {
      for (const lang of ["en", "id"] as const) {
        for (const k of KEYS) expect(dictionaries[lang][k], `${lang} ${k}`).toBeTruthy();
      }
    });

    test("the tabs read Masuk / Keluar in Indonesian", () => {
      expect(dictionaries.id["tx.transferIn"]).toBe("Masuk");
      expect(dictionaries.id["tx.transferOut"]).toBe("Keluar");
    });
  });

  describe("negative", () => {
    test("the 'Semua' empty state no longer talks about minting only", () => {
      expect(dictionaries.id["tx.emptyDesc"]).toBe("Mint, redeem, dan transfer USDX Anda akan muncul di sini.");
      expect(dictionaries.en["tx.emptyDesc"]).toMatch(/transfer/i);
    });
  });

  describe("edge case", () => {
    test("no jargon on the transfer rows", () => {
      for (const lang of ["en", "id"] as const) {
        for (const k of KEYS) expect(dictionaries[lang][k]).not.toMatch(/custodial|counterparty|nonce/i);
      }
    });
  });
});
