import { describe, test, expect } from "vitest";
import {
  ANNUAL_INCOME_RANGES,
  CDD_ERROR_KEYS,
  CDD_OPTIONS,
  EMPTY_CDD_FORM,
  OCCUPATIONS,
  SOURCES_OF_FUNDS,
  TRANSACTION_PURPOSES,
  cddOptionLabelKey,
  isCddOption,
  toCddPayload,
  validateCdd,
  type CddFormState,
} from "@/lib/kyc/cdd";
import { dictionaries } from "@/lib/i18n/dictionaries";

// USDX-545 — CDD value sets + submit-time validation for the retail KYC form.

const VALID: CddFormState = {
  occupation: "PRIVATE_EMPLOYEE",
  sourceOfFunds: "SALARY",
  annualIncomeRange: "FROM_100M_TO_500M",
  transactionPurpose: "INVESTMENT",
  pepStatus: false,
  pepRelation: "",
  npwp: "",
};

// Copied by hand from the single source of truth
// (backend/src/database/schema/partner/partner-customer-kyc.ts). If the schema
// changes, this literal is what has to be updated first — the point is that the
// app cannot drift silently.
const SCHEMA_ENUMS = {
  occupation: ["PRIVATE_EMPLOYEE", "SELF_EMPLOYED", "CIVIL_SERVANT", "STUDENT", "OTHER"],
  sourceOfFunds: ["SALARY", "BUSINESS", "INVESTMENT", "INHERITANCE", "OTHER"],
  annualIncomeRange: ["UNDER_100M", "FROM_100M_TO_500M", "FROM_500M_TO_1B", "OVER_1B"],
  transactionPurpose: ["INVESTMENT", "PAYMENT", "REMITTANCE", "OTHER"],
} as const;

describe("CDD value sets", () => {
  describe("positive", () => {
    test("match partner_customer_kyc member-for-member, in order", () => {
      expect(OCCUPATIONS).toEqual(SCHEMA_ENUMS.occupation);
      expect(SOURCES_OF_FUNDS).toEqual(SCHEMA_ENUMS.sourceOfFunds);
      expect(ANNUAL_INCOME_RANGES).toEqual(SCHEMA_ENUMS.annualIncomeRange);
      expect(TRANSACTION_PURPOSES).toEqual(SCHEMA_ENUMS.transactionPurpose);
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
      expect(isCddOption("occupation", "private_employee")).toBe(false);
      expect(isCddOption("annualIncomeRange", "100M_500M")).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("OTHER exists in three sets but INHERITANCE only in source of funds", () => {
      expect(isCddOption("occupation", "OTHER")).toBe(true);
      expect(isCddOption("sourceOfFunds", "OTHER")).toBe(true);
      expect(isCddOption("transactionPurpose", "OTHER")).toBe(true);
      // annual income is a numeric ladder — no escape hatch by design
      expect(isCddOption("annualIncomeRange", "OTHER")).toBe(false);
      expect(isCddOption("transactionPurpose", "INHERITANCE")).toBe(false);
    });
  });
});

describe("validateCdd", () => {
  describe("positive", () => {
    test("a fully answered form has no errors", () => {
      expect(validateCdd(VALID)).toEqual({});
    });

    test("NPWP is optional — empty NPWP is still valid", () => {
      expect(validateCdd({ ...VALID, npwp: "" })).toEqual({});
    });
  });

  describe("negative", () => {
    test("an untouched form reports EVERY required field by name, one message each", () => {
      const errors = validateCdd(EMPTY_CDD_FORM);
      expect(errors).toEqual({
        occupation: CDD_ERROR_KEYS.occupation,
        sourceOfFunds: CDD_ERROR_KEYS.sourceOfFunds,
        annualIncomeRange: CDD_ERROR_KEYS.annualIncomeRange,
        transactionPurpose: CDD_ERROR_KEYS.transactionPurpose,
      });
    });

    test("one missing field reports only that field", () => {
      expect(validateCdd({ ...VALID, sourceOfFunds: "" })).toEqual({
        sourceOfFunds: CDD_ERROR_KEYS.sourceOfFunds,
      });
    });

    test("each required-field message names its field in both languages", () => {
      const expectations = [
        ["occupation", "Pekerjaan", "Occupation"],
        ["sourceOfFunds", "Sumber dana", "Source of funds"],
        ["annualIncomeRange", "Penghasilan per tahun", "Annual income"],
        ["transactionPurpose", "Tujuan transaksi", "Transaction purpose"],
        ["pepRelation", "Relasi PEP", "PEP relationship"],
      ] as const;
      for (const [field, idFragment, enFragment] of expectations) {
        const key = CDD_ERROR_KEYS[field];
        expect(dictionaries.id[key]).toContain(idFragment);
        expect(dictionaries.en[key]).toContain(enFragment);
      }
    });

    test("pep_relation is required when pep_status is true", () => {
      const errors = validateCdd({ ...VALID, pepStatus: true, pepRelation: "" });
      expect(errors).toEqual({ pepRelation: CDD_ERROR_KEYS.pepRelation });
    });

    test("whitespace-only pep_relation does not satisfy the requirement", () => {
      const errors = validateCdd({ ...VALID, pepStatus: true, pepRelation: "   " });
      expect(errors).toEqual({ pepRelation: CDD_ERROR_KEYS.pepRelation });
    });
  });

  describe("edge cases", () => {
    test("pep_relation is NOT required when pep_status is false", () => {
      expect(validateCdd({ ...VALID, pepStatus: false, pepRelation: "" })).toEqual({});
    });

    test("a value outside the schema set is rejected like an empty one", () => {
      const errors = validateCdd({
        ...VALID,
        // Simulates a tampered <option> / stale build sending an unlisted member.
        occupation: "FREELANCE" as CddFormState["occupation"],
      });
      expect(errors).toEqual({ occupation: CDD_ERROR_KEYS.occupation });
    });
  });
});

describe("toCddPayload", () => {
  describe("positive", () => {
    test("emits exactly the seven CDD wire keys with schema values", () => {
      const payload = toCddPayload({
        ...VALID,
        pepStatus: true,
        pepRelation: "Ayah - anggota DPRD",
        npwp: "091234567890000",
      });
      expect(payload).toEqual({
        occupation: "PRIVATE_EMPLOYEE",
        sourceOfFunds: "SALARY",
        annualIncomeRange: "FROM_100M_TO_500M",
        transactionPurpose: "INVESTMENT",
        pepStatus: true,
        pepRelation: "Ayah - anggota DPRD",
        npwp: "091234567890000",
      });
    });
  });

  describe("negative", () => {
    test("a relation typed then retracted is not submitted", () => {
      const payload = toCddPayload({
        ...VALID,
        pepStatus: false,
        pepRelation: "Ayah - anggota DPRD",
      });
      expect(payload.pepStatus).toBe(false);
      expect(payload.pepRelation).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("empty optional PII goes out as null, not empty string", () => {
      const payload = toCddPayload({ ...VALID, npwp: "   " });
      expect(payload.npwp).toBeNull();
      expect(payload.pepRelation).toBeNull();
    });

    test("surrounding whitespace is trimmed off the PII fields", () => {
      const payload = toCddPayload({
        ...VALID,
        pepStatus: true,
        pepRelation: "  Ibu - kepala dinas  ",
        npwp: " 091234567890000 ",
      });
      expect(payload.pepRelation).toBe("Ibu - kepala dinas");
      expect(payload.npwp).toBe("091234567890000");
    });
  });
});
