import { describe, test, expect } from "vitest";

// Konfirmasi tujuan sebelum burn (USDX-661, bni-integration.md § 17.12) + status
// PAYOUT_FAILED (USDX-664, common.yaml § RedeemStatus). Keduanya diuji di sini
// karena keduanya soal yang sama: apa yang layar pra-burn/tracker BOLEH katakan
// tentang sebuah order, dan kapan tombol burn boleh ditekan.

import {
  ACCOUNT_NAME_FALLBACK,
  burnDisabled,
  destinationConfirmRequired,
  orderDestination,
} from "@/lib/redeem/destination";
import { STATUS_TONE } from "@/components/ui/status-badge";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { RedeemStatus } from "@/types";

const ORDER_RESPONSE = {
  bankName: "BCA",
  bankAccountNumber: "1234563210",
  bankAccountName: "SITI AMINAH", // jawaban bank atas nomor di atas
};

describe("orderDestination", () => {
  describe("positive", () => {
    test("reads bank, full account number and holder name from the order response", () => {
      expect(orderDestination(ORDER_RESPONSE)).toEqual({
        bankName: "BCA",
        accountNumber: "1234563210",
        accountName: "SITI AMINAH",
        accountNameKnown: true,
      });
    });

    test("the holder name is the order's, never the name the customer typed", () => {
      // Nasabah mengetik "BUDI SANTOSO"; bank menjawab "SITI AMINAH". Yang tampil
      // wajib jawaban bank — perbedaannya sendiri informasi yang berguna.
      const typedByCustomer = "BUDI SANTOSO";
      const shown = orderDestination(ORDER_RESPONSE).accountName;
      expect(shown).toBe("SITI AMINAH");
      expect(shown).not.toBe(typedByCustomer);
    });
  });

  describe("negative", () => {
    test('an empty or null holder name renders "—" and is marked unknown', () => {
      for (const bankAccountName of ["", "   ", null, undefined]) {
        const dest = orderDestination({ ...ORDER_RESPONSE, bankAccountName });
        expect(dest.accountName).toBe(ACCOUNT_NAME_FALLBACK);
        expect(dest.accountNameKnown).toBe(false);
        // Nomor rekening tetap penuh — yang tidak diketahui hanya namanya.
        expect(dest.accountNumber).toBe("1234563210");
      }
    });
  });

  describe("edge cases", () => {
    test("trims the values it prints", () => {
      const dest = orderDestination({
        bankName: " BCA ",
        bankAccountNumber: " 1234563210 ",
        bankAccountName: "  SITI AMINAH  ",
      });
      expect(dest).toMatchObject({
        bankName: "BCA",
        accountNumber: "1234563210",
        accountName: "SITI AMINAH",
      });
    });
  });
});

describe("destinationConfirmRequired", () => {
  describe("positive", () => {
    test("asked while AWAITING_BURN on the self-sign path", () => {
      expect(destinationConfirmRequired({ status: "AWAITING_BURN" }, false)).toBe(true);
      expect(
        destinationConfirmRequired({ status: "AWAITING_BURN", burnMode: "SELF_SIGN" }, false),
      ).toBe(true);
    });

    test("still asked when the bank returned no holder name — never skipped silently", () => {
      // Bloknya hadir apa pun isi namanya: yang digerbangi statusnya, bukan datanya.
      const dest = orderDestination({ ...ORDER_RESPONSE, bankAccountName: null });
      expect(dest.accountNameKnown).toBe(false);
      expect(destinationConfirmRequired({ status: "AWAITING_BURN" }, false)).toBe(true);
    });
  });

  describe("negative", () => {
    test("never asked on the CUSTODIAL path — there is no customer signature there", () => {
      expect(
        destinationConfirmRequired({ status: "AWAITING_BURN", burnMode: "CUSTODIAL" }, false),
      ).toBe(false);
    });

    test("not asked once the burn is in flight — the agreement already happened", () => {
      expect(destinationConfirmRequired({ status: "AWAITING_BURN" }, true)).toBe(false);
    });

    test("not asked in any status past the burn", () => {
      const after: RedeemStatus[] = [
        "BURNED",
        "PROCESSING_PAYOUT",
        "PAYOUT_COMPLETE",
        "PAYOUT_FAILED",
        "EXPIRED",
      ];
      for (const status of after) {
        expect(destinationConfirmRequired({ status }, false)).toBe(false);
      }
    });
  });
});

describe("burnDisabled", () => {
  const ready = { canBurn: true, walletMatches: true, destinationConfirmed: true };

  describe("positive", () => {
    test("enabled only when preconditions, wallet and the destination agreement all hold", () => {
      expect(burnDisabled(ready)).toBe(false);
    });
  });

  describe("negative", () => {
    test("disabled while the destination has not been agreed to", () => {
      expect(burnDisabled({ ...ready, destinationConfirmed: false })).toBe(true);
    });

    test("the agreement does not override the wallet precondition gate", () => {
      expect(burnDisabled({ ...ready, canBurn: false })).toBe(true);
      expect(burnDisabled({ ...ready, walletMatches: false })).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("every gate off is still just disabled", () => {
      expect(
        burnDisabled({ canBurn: false, walletMatches: false, destinationConfirmed: false }),
      ).toBe(true);
    });
  });
});

// USDX-664: the union is what the rest of the app compiles against — a status the
// backend sends but the type does not know is how the tracker ended up rendering a
// journey with no active step.
describe("RedeemStatus PAYOUT_FAILED", () => {
  describe("positive", () => {
    test("is a member of the union (compiles) and is not one of the tracker steps", () => {
      const status: RedeemStatus = "PAYOUT_FAILED";
      const TRACKER_STEPS: RedeemStatus[] = [
        "AWAITING_BURN",
        "BURNED",
        "PROCESSING_PAYOUT",
        "PAYOUT_COMPLETE",
      ];
      expect(TRACKER_STEPS).not.toContain(status);
    });

    test("has a badge tone of its own, so history never falls through to neutral", () => {
      // Neutral is what made AWAITING_BURN look exactly like EXPIRED (status-badge).
      expect(STATUS_TONE.PAYOUT_FAILED).toBe("warning");
    });

    test("has copy in both locales, and it promises no refund or re-mint", () => {
      const keys = ["redeem.statusPayoutFailed", "redeem.statusPayoutFailedDesc"];
      for (const lang of ["id", "en"] as const) {
        for (const key of keys) {
          expect(dictionaries[lang][key], `${lang} missing ${key}`).toBeTruthy();
        }
        expect(dictionaries[lang]["redeem.statusPayoutFailedDesc"]).not.toMatch(
          /refund|dana kembali|dikembalikan|mint ulang|re-mint/i,
        );
      }
    });
  });
});

// Kunci layar konfirmasi wajib ada di kedua bahasa — teks Indonesia lewat i18n,
// tidak di-hardcode di komponen.
describe("destination confirmation copy", () => {
  describe("positive", () => {
    test("every new key exists in id + en", () => {
      const keys = [
        "redeem.accountNumber",
        "redeem.confirmDestTitle",
        "redeem.confirmDestNameSource",
        "redeem.confirmDestNameMissing",
        "redeem.confirmDestWarning",
        "redeem.confirmDestCheck",
        "redeem.confirmDestCheckNoName",
      ];
      for (const lang of ["id", "en"] as const) {
        for (const key of keys) {
          expect(dictionaries[lang][key], `${lang} missing ${key}`).toBeTruthy();
        }
      }
    });

    test("the checkbox sentence carries the holder name placeholder", () => {
      for (const lang of ["id", "en"] as const) {
        expect(dictionaries[lang]["redeem.confirmDestCheck"]).toContain("{name}");
        // Varian tanpa nama tidak boleh menyisakan placeholder yang tak terisi.
        expect(dictionaries[lang]["redeem.confirmDestCheckNoName"]).not.toContain("{name}");
      }
    });

    test("the warning states both consequences: USDX gone, transfer irreversible", () => {
      expect(dictionaries.id["redeem.confirmDestWarning"]).toMatch(/hangus permanen/);
      expect(dictionaries.id["redeem.confirmDestWarning"]).toMatch(/tidak bisa dibatalkan/);
      expect(dictionaries.en["redeem.confirmDestWarning"]).toMatch(/permanently/);
      expect(dictionaries.en["redeem.confirmDestWarning"]).toMatch(/cannot be reversed/);
    });
  });
});
