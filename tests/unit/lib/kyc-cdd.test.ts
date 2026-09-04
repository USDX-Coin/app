import { describe, test, expect } from "vitest";
import {
  ANNUAL_INCOME_RANGES,
  CDD_ERROR_KEYS,
  CDD_OPTIONS,
  EMPTY_CDD_FORM,
  NET_WORTH_RANGES,
  OCCUPATIONS,
  SOURCES_OF_FUNDS,
  SOURCES_OF_WEALTH,
  TRANSACTION_PURPOSES,
  cddOptionLabelKey,
  isCddOption,
  toCddPayload,
  validateCdd,
  type CddFormState,
} from "@/lib/kyc/cdd";
import { dictionaries } from "@/lib/i18n/dictionaries";

// USDX-545 — kumpulan nilai CDD + validasi saat submit form KYC retail.
// USDX-586 — 99 pekerjaan Permendagri, net worth, sumber kekayaan, tempat kerja.

const VALID: CddFormState = {
  occupation: "KARYAWAN_SWASTA",
  sourceOfFunds: "SALARY",
  annualIncomeRange: "FROM_100M_TO_500M",
  netWorthRange: "FROM_500M_TO_2B",
  transactionPurpose: "INVESTMENT",
  pepStatus: false,
  sourceOfWealth: "",
  pepRelation: "",
  employerAddress: "",
  employerPhone: "",
  npwp: "",
};

// Disalin tangan dari sumber kebenarannya (`sot/api/kyc.yaml`). Kalau kontraknya
// berubah, literal inilah yang harus diperbarui lebih dulu — intinya supaya app
// tidak bisa melenceng diam-diam.
const SCHEMA_ENUMS = {
  occupation: [
    "BELUM_TIDAK_BEKERJA",
    "MENGURUS_RUMAH_TANGGA",
    "PELAJAR_MAHASISWA",
    "PENSIUNAN",
    "PEGAWAI_NEGERI_SIPIL",
    "TENTARA_NASIONAL_INDONESIA",
    "KEPOLISIAN_RI",
    "PERDAGANGAN",
    "PETANI_PEKEBUN",
    "PETERNAK",
    "NELAYAN_PERIKANAN",
    "INDUSTRI",
    "KONSTRUKSI",
    "TRANSPORTASI",
    "KARYAWAN_SWASTA",
    "KARYAWAN_BUMN",
    "KARYAWAN_BUMD",
    "KARYAWAN_HONORER",
    "BURUH_HARIAN_LEPAS",
    "BURUH_TANI_PERKEBUNAN",
    "BURUH_NELAYAN_PERIKANAN",
    "BURUH_PETERNAKAN",
    "PEMBANTU_RUMAH_TANGGA",
    "TUKANG_CUKUR",
    "TUKANG_LISTRIK",
    "TUKANG_BATU",
    "TUKANG_KAYU",
    "TUKANG_SOL_SEPATU",
    "TUKANG_LAS_PANDAI_BESI",
    "TUKANG_JAHIT",
    "TUKANG_GIGI",
    "PENATA_RIAS",
    "PENATA_BUSANA",
    "PENATA_RAMBUT",
    "MEKANIK",
    "SENIMAN",
    "TABIB",
    "PARAJI",
    "PERANCANG_BUSANA",
    "PENTERJEMAH",
    "IMAM_MASJID",
    "PENDETA",
    "PASTOR",
    "WARTAWAN",
    "USTADZ_MUBALIGH",
    "JURU_MASAK",
    "PROMOTOR_ACARA",
    "ANGGOTA_DPR_RI",
    "ANGGOTA_DPD",
    "ANGGOTA_BPK",
    "PRESIDEN",
    "WAKIL_PRESIDEN",
    "ANGGOTA_MAHKAMAH_KONSTITUSI",
    "ANGGOTA_KABINET_KEMENTERIAN",
    "DUTA_BESAR_KEPALA_PERWAKILAN",
    "GUBERNUR",
    "WAKIL_GUBERNUR",
    "BUPATI",
    "WAKIL_BUPATI",
    "WALIKOTA",
    "WAKIL_WALIKOTA",
    "ANGGOTA_DPRD_PROVINSI",
    "ANGGOTA_DPRD_KAB_KOTA",
    "DOSEN",
    "GURU",
    "PILOT",
    "PENGACARA",
    "NOTARIS",
    "ARSITEK",
    "AKUNTAN",
    "KONSULTAN",
    "DOKTER",
    "BIDAN",
    "PERAWAT",
    "APOTEKER",
    "PSIKIATER_PSIKOLOG",
    "PENYIAR_TELEVISI",
    "PENYIAR_RADIO",
    "PELAUT",
    "PENELITI",
    "SOPIR",
    "PIALANG",
    "PARANORMAL",
    "PEDAGANG",
    "PERANGKAT_DESA",
    "KEPALA_DESA",
    "BIARAWATI",
    "WIRASWASTA",
    "ANGGOTA_LEMBAGA_TINGGI_LAINNYA",
    "ARTIS",
    "ATLIT",
    "CHEFF",
    "MANAJER",
    "TENAGA_TATA_USAHA",
    "OPERATOR",
    "PEKERJA_PENGOLAHAN_KERAJINAN",
    "TEKNISI",
    "ASISTEN_AHLI",
    "LAINNYA",
  ],
  sourceOfFunds: ["SALARY", "BUSINESS", "INVESTMENT", "INHERITANCE", "OTHER"],
  annualIncomeRange: ["UNDER_100M", "FROM_100M_TO_500M", "FROM_500M_TO_1B", "OVER_1B"],
  netWorthRange: ["UNDER_500M", "FROM_500M_TO_2B", "FROM_2B_TO_10B", "OVER_10B"],
  transactionPurpose: ["INVESTMENT", "PAYMENT", "REMITTANCE", "OTHER"],
  sourceOfWealth: [
    "SALARY_ACCUMULATION",
    "BUSINESS_OWNERSHIP",
    "INVESTMENT_RETURN",
    "INHERITANCE",
    "PROPERTY_SALE",
    "GRANT_OR_GIFT",
    "OTHER",
  ],
} as const;

describe("CDD value sets", () => {
  describe("positive", () => {
    test("match kyc.yaml member-for-member, in order", () => {
      expect(OCCUPATIONS).toEqual(SCHEMA_ENUMS.occupation);
      expect(SOURCES_OF_FUNDS).toEqual(SCHEMA_ENUMS.sourceOfFunds);
      expect(ANNUAL_INCOME_RANGES).toEqual(SCHEMA_ENUMS.annualIncomeRange);
      expect(NET_WORTH_RANGES).toEqual(SCHEMA_ENUMS.netWorthRange);
      expect(TRANSACTION_PURPOSES).toEqual(SCHEMA_ENUMS.transactionPurpose);
      expect(SOURCES_OF_WEALTH).toEqual(SCHEMA_ENUMS.sourceOfWealth);
    });

    test("occupation carries all 99 Permendagri 109/2019 jobs", () => {
      expect(OCCUPATIONS).toHaveLength(99);
      // Kode 1, 15, 88 dan 99 — empat titik yang paling sering dipakai nasabah.
      expect(OCCUPATIONS[0]).toBe("BELUM_TIDAK_BEKERJA");
      expect(OCCUPATIONS[14]).toBe("KARYAWAN_SWASTA");
      expect(OCCUPATIONS[87]).toBe("WIRASWASTA");
      expect(OCCUPATIONS[98]).toBe("LAINNYA");
    });

    test("every member has an Indonesian AND an English label", () => {
      for (const field of Object.keys(CDD_OPTIONS) as (keyof typeof CDD_OPTIONS)[]) {
        for (const value of CDD_OPTIONS[field]) {
          const key = cddOptionLabelKey(field, value);
          expect(dictionaries.id[key], `missing id label for ${key}`).toBeTruthy();
          expect(dictionaries.en[key], `missing en label for ${key}`).toBeTruthy();
        }
      }
    });

    test("occupation labels keep the Permendagri wording, untranslated, in both languages", () => {
      // Alasannya bukan malas menerjemahkan: label ini yang tercetak di kolom
      // "Pekerjaan" KTP-el, dan petugas mencocokkan jawaban dengan dokumen itu.
      for (const value of CDD_OPTIONS.occupation) {
        const key = cddOptionLabelKey("occupation", value);
        expect(dictionaries.en[key]).toBe(dictionaries.id[key]);
      }
      expect(dictionaries.id[cddOptionLabelKey("occupation", "KARYAWAN_SWASTA")]).toBe(
        "Karyawan Swasta",
      );
      expect(dictionaries.id[cddOptionLabelKey("occupation", "WIRASWASTA")]).toBe("Wiraswasta");
      // Ejaan asli Permendagri, bukan salah ketik yang perlu "diperbaiki".
      expect(dictionaries.id[cddOptionLabelKey("occupation", "CHEFF")]).toBe("Cheff");
    });

    test("no Indonesian label leaks the technical value", () => {
      for (const field of Object.keys(CDD_OPTIONS) as (keyof typeof CDD_OPTIONS)[]) {
        for (const value of CDD_OPTIONS[field]) {
          expect(dictionaries.id[cddOptionLabelKey(field, value)]).not.toContain(value);
        }
      }
    });
  });

  describe("negative", () => {
    test("no member starts with a digit (breaks generated clients)", () => {
      for (const values of Object.values(CDD_OPTIONS)) {
        for (const value of values) expect(value).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    });

    test("isCddOption rejects the empty placeholder and unknown values", () => {
      expect(isCddOption("occupation", "")).toBe(false);
      expect(isCddOption("occupation", "FREELANCE")).toBe(false);
      expect(isCddOption("occupation", "karyawan_swasta")).toBe(false);
      expect(isCddOption("annualIncomeRange", "100M_500M")).toBe(false);
    });

    test("the five pre-USDX-586 occupation values are gone, not aliased", () => {
      // Dipetakan ke nilai Permendagri di kyc.yaml; menerima yang lama diam-diam
      // akan membuat dua ejaan hidup berdampingan di tabel yang sama.
      for (const legacy of [
        "PRIVATE_EMPLOYEE",
        "SELF_EMPLOYED",
        "CIVIL_SERVANT",
        "STUDENT",
        "OTHER",
      ]) {
        expect(isCddOption("occupation", legacy)).toBe(false);
      }
    });
  });

  describe("edge cases", () => {
    test("OTHER exists in three sets but INHERITANCE is not a transaction purpose", () => {
      expect(isCddOption("sourceOfFunds", "OTHER")).toBe(true);
      expect(isCddOption("transactionPurpose", "OTHER")).toBe(true);
      expect(isCddOption("sourceOfWealth", "OTHER")).toBe(true);
      // Pekerjaan punya jalan keluarnya sendiri: LAINNYA (kode 99), bukan OTHER.
      expect(isCddOption("occupation", "LAINNYA")).toBe(true);
      // Penghasilan dan net worth adalah tangga angka — tidak ada jalan keluar.
      expect(isCddOption("annualIncomeRange", "OTHER")).toBe(false);
      expect(isCddOption("netWorthRange", "OTHER")).toBe(false);
      expect(isCddOption("transactionPurpose", "INHERITANCE")).toBe(false);
    });
  });
});

describe("validateCdd", () => {
  describe("positive", () => {
    test("a fully answered form has no errors", () => {
      expect(validateCdd(VALID)).toEqual({});
    });

    test("NPWP and workplace details are optional — empty is still valid", () => {
      expect(
        validateCdd({ ...VALID, npwp: "", employerAddress: "", employerPhone: "" }),
      ).toEqual({});
    });

    test("a declared PEP with both extra answers is valid", () => {
      expect(
        validateCdd({
          ...VALID,
          pepStatus: true,
          pepRelation: "Ayah - anggota DPRD",
          sourceOfWealth: "INHERITANCE",
        }),
      ).toEqual({});
    });
  });

  describe("negative", () => {
    test("an untouched form reports EVERY required field by name, one message each", () => {
      const errors = validateCdd(EMPTY_CDD_FORM);
      expect(errors).toEqual({
        occupation: CDD_ERROR_KEYS.occupation,
        sourceOfFunds: CDD_ERROR_KEYS.sourceOfFunds,
        annualIncomeRange: CDD_ERROR_KEYS.annualIncomeRange,
        netWorthRange: CDD_ERROR_KEYS.netWorthRange,
        transactionPurpose: CDD_ERROR_KEYS.transactionPurpose,
      });
    });

    test("one missing field reports only that field", () => {
      expect(validateCdd({ ...VALID, sourceOfFunds: "" })).toEqual({
        sourceOfFunds: CDD_ERROR_KEYS.sourceOfFunds,
      });
      expect(validateCdd({ ...VALID, netWorthRange: "" })).toEqual({
        netWorthRange: CDD_ERROR_KEYS.netWorthRange,
      });
    });

    test("each required-field message names its field in both languages", () => {
      const expectations = [
        ["occupation", "Pekerjaan", "Occupation"],
        ["sourceOfFunds", "Sumber dana", "Source of funds"],
        ["annualIncomeRange", "Penghasilan per tahun", "Annual income"],
        ["netWorthRange", "Nilai harta kekayaan", "Net worth"],
        ["transactionPurpose", "Tujuan transaksi", "Transaction purpose"],
        ["sourceOfWealth", "Sumber kekayaan", "Source of wealth"],
        ["pepRelation", "Relasi PEP", "PEP relationship"],
      ] as const;
      for (const [field, idFragment, enFragment] of expectations) {
        const key = CDD_ERROR_KEYS[field];
        expect(dictionaries.id[key]).toContain(idFragment);
        expect(dictionaries.en[key]).toContain(enFragment);
      }
    });

    test("pep_relation AND source_of_wealth are required when pep_status is true", () => {
      const errors = validateCdd({ ...VALID, pepStatus: true });
      expect(errors).toEqual({
        pepRelation: CDD_ERROR_KEYS.pepRelation,
        sourceOfWealth: CDD_ERROR_KEYS.sourceOfWealth,
      });
    });

    test("whitespace-only pep_relation does not satisfy the requirement", () => {
      const errors = validateCdd({
        ...VALID,
        pepStatus: true,
        pepRelation: "   ",
        sourceOfWealth: "INHERITANCE",
      });
      expect(errors).toEqual({ pepRelation: CDD_ERROR_KEYS.pepRelation });
    });
  });

  describe("edge cases", () => {
    test("pep-only answers are NOT required when pep_status is false", () => {
      expect(validateCdd({ ...VALID, pepStatus: false, pepRelation: "", sourceOfWealth: "" })).toEqual(
        {},
      );
    });

    test("a value outside the schema set is rejected like an empty one", () => {
      const errors = validateCdd({
        ...VALID,
        // Meniru <option> yang dioprek / build basi mengirim anggota yang tidak terdaftar.
        occupation: "FREELANCE" as CddFormState["occupation"],
      });
      expect(errors).toEqual({ occupation: CDD_ERROR_KEYS.occupation });
    });
  });
});

describe("toCddPayload", () => {
  describe("positive", () => {
    test("emits exactly the eleven CDD wire keys with schema values", () => {
      const payload = toCddPayload({
        ...VALID,
        pepStatus: true,
        pepRelation: "Ayah - anggota DPRD",
        sourceOfWealth: "INHERITANCE",
        employerAddress: "Gedung Cyber 2 Lt. 15, Jakarta Selatan",
        employerPhone: "+62215551234",
        npwp: "091234567890000",
      });
      expect(payload).toEqual({
        occupation: "KARYAWAN_SWASTA",
        sourceOfFunds: "SALARY",
        annualIncomeRange: "FROM_100M_TO_500M",
        netWorthRange: "FROM_500M_TO_2B",
        transactionPurpose: "INVESTMENT",
        sourceOfWealth: "INHERITANCE",
        employerAddress: "Gedung Cyber 2 Lt. 15, Jakarta Selatan",
        employerPhone: "+62215551234",
        pepStatus: true,
        pepRelation: "Ayah - anggota DPRD",
        npwp: "091234567890000",
      });
    });
  });

  describe("negative", () => {
    test("pep answers typed then retracted are not submitted", () => {
      const payload = toCddPayload({
        ...VALID,
        pepStatus: false,
        pepRelation: "Ayah - anggota DPRD",
        sourceOfWealth: "INHERITANCE",
      });
      expect(payload.pepStatus).toBe(false);
      expect(payload.pepRelation).toBeNull();
      expect(payload.sourceOfWealth).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("empty optional PII goes out as null, not empty string", () => {
      const payload = toCddPayload({ ...VALID, npwp: "   ", employerAddress: "  " });
      expect(payload.npwp).toBeNull();
      expect(payload.employerAddress).toBeNull();
      expect(payload.employerPhone).toBeNull();
      expect(payload.pepRelation).toBeNull();
      expect(payload.sourceOfWealth).toBeNull();
    });

    test("surrounding whitespace is trimmed off the PII fields", () => {
      const payload = toCddPayload({
        ...VALID,
        pepStatus: true,
        pepRelation: "  Ibu - kepala dinas  ",
        sourceOfWealth: "SALARY_ACCUMULATION",
        employerAddress: "  Jl. Thamrin No. 1  ",
        employerPhone: "  +62215551234  ",
        npwp: " 091234567890000 ",
      });
      expect(payload.pepRelation).toBe("Ibu - kepala dinas");
      expect(payload.employerAddress).toBe("Jl. Thamrin No. 1");
      expect(payload.employerPhone).toBe("+62215551234");
      expect(payload.npwp).toBe("091234567890000");
    });
  });
});
