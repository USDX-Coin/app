import { describe, test, expect } from "vitest";
import {
  EMPTY_IDENTITY_FORM,
  GENDERS,
  IDENTITY_ERROR_KEYS,
  IDENTITY_OPTIONS,
  IDENTITY_TYPES,
  MARITAL_STATUSES,
  identityDocLabelKey,
  identityNumberErrorKey,
  identityNumberLabelKey,
  identityNumberPlaceholderKey,
  identityOptionLabelKey,
  isIdentityNumberValid,
  selfieDocLabelKey,
  toIdentityPayload,
  validateIdentity,
  type IdentityFormState,
} from "@/lib/kyc/identity";
import { dictionaries } from "@/lib/i18n/dictionaries";

// USDX-586 — blok identitas form KYC dilengkapi ke POJK 8/2023 Pasal 25 ayat (1)
// huruf a. Nilai enum disalin dari `sot/api/kyc.yaml`.

const VALID: IdentityFormState = {
  ...EMPTY_IDENTITY_FORM,
  firstName: "Budi",
  lastName: "Santoso",
  dob: "1995-03-15",
  birthPlace: "Jakarta",
  identityNumber: "3171234567890123",
  gender: "LAKI_LAKI",
  maritalStatus: "KAWIN",
  mothersMaidenName: "Siti Aminah",
  addressLine1: "Jl. Sudirman No. 1",
};

describe("identity value sets", () => {
  describe("positive", () => {
    test("match kyc.yaml member-for-member, in order", () => {
      expect(GENDERS).toEqual(["LAKI_LAKI", "PEREMPUAN"]);
      expect(MARITAL_STATUSES).toEqual(["BELUM_KAWIN", "KAWIN", "CERAI_HIDUP", "CERAI_MATI"]);
    });

    test("every member has an Indonesian AND an English label", () => {
      for (const field of Object.keys(IDENTITY_OPTIONS) as (keyof typeof IDENTITY_OPTIONS)[]) {
        for (const value of IDENTITY_OPTIONS[field]) {
          const key = identityOptionLabelKey(field, value);
          expect(dictionaries.id[key], `missing id label for ${key}`).toBeTruthy();
          expect(dictionaries.en[key], `missing en label for ${key}`).toBeTruthy();
        }
      }
    });

    test("no Indonesian label leaks the technical value", () => {
      for (const field of Object.keys(IDENTITY_OPTIONS) as (keyof typeof IDENTITY_OPTIONS)[]) {
        for (const value of IDENTITY_OPTIONS[field]) {
          if (value === "KTP") continue; // nilai DAN label memang "KTP" di kedua bahasa
          expect(dictionaries.id[identityOptionLabelKey(field, value)]).not.toContain(value);
        }
      }
    });
  });

  describe("negative", () => {
    test("DRIVER_LICENSE is NOT offered as a choice", () => {
      // Ada di enum kontrak tapi tidak disebut Pasal 26 ayat (2) sebagai dokumen
      // identitas yang sah untuk CDD; kyc.yaml: "jangan tawarkan di form baru".
      expect(IDENTITY_TYPES).toEqual(["KTP", "PASSPORT"]);
      expect(IDENTITY_TYPES as readonly string[]).not.toContain("DRIVER_LICENSE");
    });

    test("no member starts with a digit (breaks generated clients)", () => {
      for (const values of Object.values(IDENTITY_OPTIONS)) {
        for (const value of values) expect(value).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    });
  });
});

describe("isIdentityNumberValid", () => {
  describe("positive", () => {
    test("KTP accepts exactly 16 digits", () => {
      expect(isIdentityNumberValid("KTP", "3171234567890123")).toBe(true);
    });

    test("a passport number may contain letters and is not 16 digits long", () => {
      expect(isIdentityNumberValid("PASSPORT", "C1234567")).toBe(true);
      expect(isIdentityNumberValid("PASSPORT", "X12345678901234567890")).toBe(true);
    });
  });

  describe("negative", () => {
    test("KTP rejects 15 digits, 17 digits, and letters", () => {
      expect(isIdentityNumberValid("KTP", "317123456789012")).toBe(false);
      expect(isIdentityNumberValid("KTP", "31712345678901234")).toBe(false);
      expect(isIdentityNumberValid("KTP", "3171234567890A23")).toBe(false);
    });

    test("a passport number still cannot be empty or whitespace", () => {
      expect(isIdentityNumberValid("PASSPORT", "")).toBe(false);
      expect(isIdentityNumberValid("PASSPORT", "   ")).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("the 16-digit rule is NOT applied to passports (USDX-586 AC)", () => {
      const ktpOnly = "C1234567";
      expect(isIdentityNumberValid("KTP", ktpOnly)).toBe(false);
      expect(isIdentityNumberValid("PASSPORT", ktpOnly)).toBe(true);
    });

    test("label, placeholder and error message all follow the document type", () => {
      for (const [ktpKey, passportKey, pick] of [
        ["kyc.identityNumber", "kyc.identityNumberPassport", identityNumberLabelKey],
        ["kyc.identityNumberPh", "kyc.identityNumberPassportPh", identityNumberPlaceholderKey],
        ["kyc.err.nik", "kyc.err.passportNumber", identityNumberErrorKey],
        ["kyc.ktpPhoto", "kyc.passportPhoto", identityDocLabelKey],
        ["kyc.selfiePhoto", "kyc.selfiePhotoPassport", selfieDocLabelKey],
      ] as const) {
        expect(pick("KTP")).toBe(ktpKey);
        expect(pick("PASSPORT")).toBe(passportKey);
        // Kunci apa pun yang bisa dipilih fungsi-fungsi itu harus punya teksnya.
        for (const key of [ktpKey, passportKey]) {
          expect(dictionaries.id[key], `missing id copy for ${key}`).toBeTruthy();
          expect(dictionaries.en[key], `missing en copy for ${key}`).toBeTruthy();
        }
      }
    });
  });
});

describe("validateIdentity", () => {
  describe("positive", () => {
    test("a fully answered form has no errors", () => {
      expect(validateIdentity(VALID)).toEqual({});
    });

    test("alias and second address line are optional — empty is still valid", () => {
      expect(validateIdentity({ ...VALID, aliasName: "", addressLine2: "" })).toEqual({});
    });

    test("a passport holder passes without a 16-digit number", () => {
      expect(
        validateIdentity({
          ...VALID,
          identityType: "PASSPORT",
          identityNumber: "C1234567",
          nationality: "SG",
        }),
      ).toEqual({});
    });
  });

  describe("negative", () => {
    test("an untouched form reports EVERY required field by name, one message each", () => {
      const errors = validateIdentity(EMPTY_IDENTITY_FORM);
      expect(errors).toEqual({
        firstName: IDENTITY_ERROR_KEYS.firstName,
        lastName: IDENTITY_ERROR_KEYS.lastName,
        dob: IDENTITY_ERROR_KEYS.dob,
        birthPlace: IDENTITY_ERROR_KEYS.birthPlace,
        // `nationality` sudah terisi "ID" secara default, jadi ia TIDAK muncul di sini.
        identityNumber: "kyc.err.nik",
        gender: IDENTITY_ERROR_KEYS.gender,
        maritalStatus: IDENTITY_ERROR_KEYS.maritalStatus,
        mothersMaidenName: IDENTITY_ERROR_KEYS.mothersMaidenName,
        addressLine1: IDENTITY_ERROR_KEYS.addressLine1,
      });
    });

    test("one missing new field reports only that field", () => {
      expect(validateIdentity({ ...VALID, gender: "" })).toEqual({
        gender: IDENTITY_ERROR_KEYS.gender,
      });
      expect(validateIdentity({ ...VALID, mothersMaidenName: "  " })).toEqual({
        mothersMaidenName: IDENTITY_ERROR_KEYS.mothersMaidenName,
      });
    });

    test("each required-field message names its field in both languages", () => {
      const expectations = [
        ["nationality", "Kewarganegaraan", "Nationality"],
        ["gender", "Jenis kelamin", "Gender"],
        ["maritalStatus", "Status perkawinan", "Marital status"],
        ["mothersMaidenName", "Nama gadis ibu kandung", "Mother's maiden name"],
      ] as const;
      for (const [field, idFragment, enFragment] of expectations) {
        const key = IDENTITY_ERROR_KEYS[field];
        expect(dictionaries.id[key]).toContain(idFragment);
        expect(dictionaries.en[key]).toContain(enFragment);
      }
    });

    test("nationality must be a two-letter uppercase ISO code", () => {
      for (const bad of ["", "I", "IDN", "id", "I1"]) {
        expect(validateIdentity({ ...VALID, nationality: bad })).toEqual({
          nationality: IDENTITY_ERROR_KEYS.nationality,
        });
      }
    });
  });

  describe("edge cases", () => {
    test("nationality and country are separate answers — a WNI abroad is valid", () => {
      // kyc.yaml: `country` = negara alamat tinggal (dikunci "ID" di Phase 2 awal),
      // `nationality` = kewarganegaraan orangnya. Menyatukan keduanya membuat
      // Pasal 25 (1) a angka 1 butir e) tidak terpenuhi untuk siapa pun di luar negeri.
      const payload = toIdentityPayload({ ...VALID, nationality: "ID" });
      expect(payload.nationality).toBe("ID");
      expect(payload).not.toHaveProperty("country");
    });
  });
});

describe("toIdentityPayload", () => {
  describe("positive", () => {
    test("emits the identity wire keys with contract values", () => {
      expect(
        toIdentityPayload({ ...VALID, aliasName: "Bambang Sutrisno", addressLine2: "Kos B12" }),
      ).toEqual({
        firstName: "Budi",
        lastName: "Santoso",
        aliasName: "Bambang Sutrisno",
        dob: "1995-03-15",
        birthPlace: "Jakarta",
        identityType: "KTP",
        identityNumber: "3171234567890123",
        nationality: "ID",
        gender: "LAKI_LAKI",
        maritalStatus: "KAWIN",
        mothersMaidenName: "Siti Aminah",
        addressLine1: "Jl. Sudirman No. 1",
        addressLine2: "Kos B12",
      });
    });
  });

  describe("edge cases", () => {
    test("empty optional fields go out as null, not empty string", () => {
      const payload = toIdentityPayload({ ...VALID, aliasName: "   ", addressLine2: "" });
      expect(payload.aliasName).toBeNull();
      expect(payload.addressLine2).toBeNull();
    });

    test("surrounding whitespace is trimmed off every text field", () => {
      const payload = toIdentityPayload({
        ...VALID,
        firstName: "  Budi  ",
        mothersMaidenName: "  Siti Aminah  ",
        identityNumber: " 3171234567890123 ",
      });
      expect(payload.firstName).toBe("Budi");
      expect(payload.mothersMaidenName).toBe("Siti Aminah");
      expect(payload.identityNumber).toBe("3171234567890123");
    });
  });
});
