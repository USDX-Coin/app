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
  bankAccountNameVerified: true, // …dan order-nya menyatakan itu memang jawaban bank
};

describe("orderDestination", () => {
  describe("positive", () => {
    test("reads bank, full account number and holder name from the order response", () => {
      expect(orderDestination(ORDER_RESPONSE)).toEqual({
        bankName: "BCA",
        accountNumber: "1234563210",
        accountName: "SITI AMINAH",
        accountNameKnown: true,
        accountNameVerified: true,
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
        // Tak ada nama = tak ada yang bisa diklaim terverifikasi, apa pun isi flag-nya.
        expect(dest.accountNameVerified).toBe(false);
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

// USDX-672 — inti tiketnya: backend jatuh ke nama ketikan nasabah saat provider
// tidak menjawab nama (`inquiry.accountName ?? bank.bankAccountName`), dan tanpa
// `bankAccountNameVerified` klien tidak punya cara membedakannya. Jadi yang diuji di
// sini adalah HAK BICARA layar itu: kapan ia boleh berkata "jawaban bank".
describe("orderDestination — provenance of the holder name", () => {
  describe("positive", () => {
    test("verified only when the order says so explicitly", () => {
      expect(orderDestination(ORDER_RESPONSE).accountNameVerified).toBe(true);
    });
  });

  describe("negative", () => {
    test("false → the name is shown, but nothing is claimed about where it came from", () => {
      // Jalur provider MOCK: nama yang tampil justru ketikan nasabah sendiri.
      const dest = orderDestination({
        ...ORDER_RESPONSE,
        bankAccountName: "BUDI SANTOSO",
        bankAccountNameVerified: false,
      });
      expect(dest.accountName).toBe("BUDI SANTOSO"); // tetap ditampilkan
      expect(dest.accountNameKnown).toBe(true); // bukan "—"
      expect(dest.accountNameVerified).toBe(false); // tapi tanpa klaim asal-usul
    });

    test("a missing field is read exactly like false — backend has not merged yet", () => {
      const { bankAccountNameVerified: _omitted, ...withoutTheField } = ORDER_RESPONSE;
      const dest = orderDestination(withoutTheField);
      expect(dest.accountName).toBe("SITI AMINAH");
      expect(dest.accountNameVerified).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("only a literal true verifies — no truthiness, no null, no string", () => {
      const notTrue = [false, undefined, null, 0, 1, "true", "", {}];
      for (const value of notTrue) {
        const dest = orderDestination({
          ...ORDER_RESPONSE,
          bankAccountNameVerified: value as unknown as boolean,
        });
        expect(dest.accountNameVerified, `${String(value)} must not verify`).toBe(false);
      }
    });

    test("the agreement is still required either way — the gate does not weaken", () => {
      for (const bankAccountNameVerified of [true, false, undefined]) {
        const dest = orderDestination({ ...ORDER_RESPONSE, bankAccountNameVerified });
        expect(destinationConfirmRequired({ status: "AWAITING_BURN" }, false)).toBe(true);
        // Dan tombol burn tetap mati sampai dicentang, terverifikasi atau tidak.
        expect(
          burnDisabled({ canBurn: true, walletMatches: true, destinationConfirmed: false }),
        ).toBe(true);
        expect(dest.accountName).toBe("SITI AMINAH"); // namanya tidak pernah disembunyikan
      }
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

    // Ops bisa me-resolve order ini CLOSED = tidak akan dibayar, dan FE tidak punya
    // field resolusi untuk membedakannya dari RESEND/SETTLED_MANUAL. Jadi teksnya
    // tidak boleh menjanjikan pembayarannya jadi — cuma bahwa orang menanganinya.
    test("promises the team is handling it, never that the payout will happen", () => {
      for (const lang of ["id", "en"] as const) {
        const copy = dictionaries[lang]["redeem.statusPayoutFailedDesc"];
        expect(copy).not.toMatch(
          /menuntaskan pembayaran|melanjutkan pembayaran|akan dibayar|akan dicairkan|settling the payout|complete the payout|will be paid|will be disbursed/i,
        );
        // Tetap menyebut keadaannya apa adanya dan tidak membebani nasabah.
        expect(copy).toMatch(/sudah terbakar|already burned/i);
        expect(copy).toMatch(/tim kami sedang menangani|our team is handling/i);
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
        "redeem.confirmDestNameUnverified",
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

    // USDX-672: satu-satunya kalimat yang boleh mengklaim asal nama adalah
    // `confirmDestNameSource`, dan ia hanya dipasang saat terverifikasi.
    test("only the verified caption claims the bank answered", () => {
      expect(dictionaries.id["redeem.confirmDestNameSource"]).toMatch(/^Jawaban bank/);
      expect(dictionaries.en["redeem.confirmDestNameSource"]).toMatch(/bank's answer/);
      for (const lang of ["id", "en"] as const) {
        const unverified = dictionaries[lang]["redeem.confirmDestNameUnverified"];
        // Tidak mengklaim bank menjawab apa pun…
        expect(unverified).not.toMatch(/jawaban bank|bank's answer|menurut bank|from the bank/i);
        // …tidak menyebut provider (nasabah tidak perlu tahu soal itu)…
        expect(unverified).not.toMatch(/provider|inquiry|MOCK|DurianPay|backend|API/i);
        // …dan tidak menakuti dengan tuduhan ada yang salah.
        expect(unverified).not.toMatch(/salah|palsu|penipuan|wrong|invalid|fraud|error/i);
      }
      // Yang ia katakan: belum dikonfirmasi bank, jadi periksa sendiri.
      expect(dictionaries.id["redeem.confirmDestNameUnverified"]).toMatch(
        /belum dikonfirmasi bank/,
      );
      expect(dictionaries.id["redeem.confirmDestNameUnverified"]).toMatch(/periksa sendiri/);
      expect(dictionaries.en["redeem.confirmDestNameUnverified"]).toMatch(
        /not been confirmed by the bank/,
      );
      expect(dictionaries.en["redeem.confirmDestNameUnverified"]).toMatch(/check it carefully/);
    });

    // F3 — tombol Ringkasan tidak lagi mengaku membakar: handler-nya cuma membuat order.
    test("the Ringkasan button names the step it reaches, not a burn", () => {
      for (const lang of ["id", "en"] as const) {
        expect(dictionaries[lang]["btn.continueToConfirm"]).toBeTruthy();
        expect(dictionaries[lang]["btn.continueToConfirm"]).not.toMatch(/burn|bakar/i);
      }
      // Dialog PIN custodial tetap "Konfirmasi & Burn" — di situ ia benar: PIN-nya
      // membuat order SEKALIGUS menyuruh sistem membakarnya.
      expect(dictionaries.id["btn.confirmBurn"]).toMatch(/Burn/);
      expect(dictionaries.en["btn.confirmBurn"]).toMatch(/Burn/);
    });

    test("the warning states both consequences: USDX gone, transfer irreversible", () => {
      expect(dictionaries.id["redeem.confirmDestWarning"]).toMatch(/hangus permanen/);
      expect(dictionaries.id["redeem.confirmDestWarning"]).toMatch(/tidak bisa dibatalkan/);
      expect(dictionaries.en["redeem.confirmDestWarning"]).toMatch(/permanently/);
      expect(dictionaries.en["redeem.confirmDestWarning"]).toMatch(/cannot be reversed/);
    });
  });
});
