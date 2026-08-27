// CDD (Customer Due Diligence) value sets + submit-time validation for the retail
// KYC form (USDX-545).
//
// WHY THIS EXISTS: today's /kyc form collects IDENTITY only (name, dob, KTP,
// address, photos). The partner API REQUIRES its partners to hand over full CDD
// for every customer (`partner_customer_kyc`), so scoring our own retail
// customers on less data would leave USDX with two CDD standards inside one legal
// entity — the weaker one facing the customers we deal with directly.
//
// SINGLE SOURCE OF TRUTH for the values below:
//   backend/src/database/schema/partner/partner-customer-kyc.ts
// (`partner_occupation`, `partner_source_of_funds`, `partner_annual_income_range`,
// `partner_transaction_purpose`). Values are copied VERBATIM. Do not invent, alias
// or re-order members here — if the UI needs a choice that the schema does not
// have, that is a backend/compliance change, not a front-end one.
//
// THE VALUES ARE WIRE FORMAT, NEVER UI TEXT. Every member is rendered through
// `t(cddOptionLabelKey(...))` so the user only ever sees an Indonesian label;
// `PRIVATE_EMPLOYEE` / `FROM_100M_TO_500M` must not appear on screen.

// --- Value sets (verbatim from partner-customer-kyc.ts) ---------------------------------------

export const OCCUPATIONS = [
  "PRIVATE_EMPLOYEE",
  "SELF_EMPLOYED",
  "CIVIL_SERVANT",
  "STUDENT",
  "OTHER",
] as const;

export const SOURCES_OF_FUNDS = [
  "SALARY",
  "BUSINESS",
  "INVESTMENT",
  "INHERITANCE",
  "OTHER",
] as const;

// Amounts are in rupiah. The `UNDER_ / FROM_…_TO_ / OVER_` spelling is the
// RESOLVED-27-Aug-2026 naming in the schema — the earlier `100M_500M` form was
// dropped because a leading digit is not a valid identifier in a generated client.
// Do not reintroduce digit-leading members.
export const ANNUAL_INCOME_RANGES = [
  "UNDER_100M",
  "FROM_100M_TO_500M",
  "FROM_500M_TO_1B",
  "OVER_1B",
] as const;

export const TRANSACTION_PURPOSES = [
  "INVESTMENT",
  "PAYMENT",
  "REMITTANCE",
  "OTHER",
] as const;

export type Occupation = (typeof OCCUPATIONS)[number];
export type SourceOfFunds = (typeof SOURCES_OF_FUNDS)[number];
export type AnnualIncomeRange = (typeof ANNUAL_INCOME_RANGES)[number];
export type TransactionPurpose = (typeof TRANSACTION_PURPOSES)[number];

/** The four CDD dropdowns, keyed by the form field they populate. */
export const CDD_OPTIONS = {
  occupation: OCCUPATIONS,
  sourceOfFunds: SOURCES_OF_FUNDS,
  annualIncomeRange: ANNUAL_INCOME_RANGES,
  transactionPurpose: TRANSACTION_PURPOSES,
} as const;

export type CddSelectField = keyof typeof CDD_OPTIONS;

/**
 * i18n key for one option label, e.g. `kyc.cdd.occupation.PRIVATE_EMPLOYEE`.
 * Every key returned here must exist in BOTH dictionaries (asserted by
 * tests/unit/lib/kyc-cdd.test.ts) — a missing key would fall through `t()` and
 * render the raw technical value on screen.
 */
export function cddOptionLabelKey(field: CddSelectField, value: string): string {
  return `kyc.cdd.${field}.${value}`;
}

// --- Form shape -------------------------------------------------------------------------------

/**
 * CDD half of the KYC form, as held in component state. Selects start empty
 * (`""`) so "not answered yet" is distinguishable from any real member — there is
 * deliberately no default: a pre-selected occupation is an answer the customer
 * never gave.
 */
export interface CddFormState {
  occupation: Occupation | "";
  sourceOfFunds: SourceOfFunds | "";
  annualIncomeRange: AnnualIncomeRange | "";
  transactionPurpose: TransactionPurpose | "";
  /** "you or a close relative holds public office". */
  pepStatus: boolean;
  /** PII. Asked for — and required — only when `pepStatus` is true. */
  pepRelation: string;
  /** PII. Optional: only customers who actually have an NPWP. */
  npwp: string;
}

export const EMPTY_CDD_FORM: CddFormState = {
  occupation: "",
  sourceOfFunds: "",
  annualIncomeRange: "",
  transactionPurpose: "",
  pepStatus: false,
  pepRelation: "",
  npwp: "",
};

export type CddErrorField =
  | "occupation"
  | "sourceOfFunds"
  | "annualIncomeRange"
  | "transactionPurpose"
  | "pepRelation";

/**
 * Per-field i18n error keys. Every message these resolve to NAMES THE FIELD
 * ("Pekerjaan wajib dipilih"), never a generic "please complete the form" —
 * USDX-545 AC: "pesan error yang menyebut field mana".
 */
export const CDD_ERROR_KEYS: Record<CddErrorField, string> = {
  occupation: "kyc.err.occupation",
  sourceOfFunds: "kyc.err.sourceOfFunds",
  annualIncomeRange: "kyc.err.annualIncomeRange",
  transactionPurpose: "kyc.err.transactionPurpose",
  pepRelation: "kyc.err.pepRelation",
};

/**
 * Submit-time validation of the CDD block. Returns the i18n error key per
 * offending field; an empty object means valid.
 *
 * `pepRelation` is required IF AND ONLY IF `pepStatus` is true — when the answer
 * is "no", the field is not rendered at all, so demanding it would be
 * unsatisfiable. `npwp` is never required (optional by design).
 */
export function validateCdd(form: CddFormState): Partial<Record<CddErrorField, string>> {
  const errors: Partial<Record<CddErrorField, string>> = {};

  for (const field of ["occupation", "sourceOfFunds", "annualIncomeRange", "transactionPurpose"] as const) {
    if (!isCddOption(field, form[field])) errors[field] = CDD_ERROR_KEYS[field];
  }
  if (form.pepStatus && !form.pepRelation.trim()) {
    errors.pepRelation = CDD_ERROR_KEYS.pepRelation;
  }

  return errors;
}

/** Guard: is `value` an actual member of the field's set (and not `""`)? */
export function isCddOption(field: CddSelectField, value: string): boolean {
  return (CDD_OPTIONS[field] as readonly string[]).includes(value);
}

/**
 * Component state → request body. Narrows the `| ""` select types after
 * `validateCdd` has passed, and normalises the two optional PII fields to `null`
 * rather than `""` so the backend stores NULL (the retention sweeper NULLs these
 * columns in place; `""` would look like a real answer).
 *
 * `pepRelation` is dropped to `null` whenever `pepStatus` is false — a stale
 * relation typed before the customer un-checked the box must not be submitted.
 */
export function toCddPayload(form: CddFormState): {
  occupation: Occupation;
  sourceOfFunds: SourceOfFunds;
  annualIncomeRange: AnnualIncomeRange;
  transactionPurpose: TransactionPurpose;
  pepStatus: boolean;
  pepRelation: string | null;
  npwp: string | null;
} {
  return {
    occupation: form.occupation as Occupation,
    sourceOfFunds: form.sourceOfFunds as SourceOfFunds,
    annualIncomeRange: form.annualIncomeRange as AnnualIncomeRange,
    transactionPurpose: form.transactionPurpose as TransactionPurpose,
    pepStatus: form.pepStatus,
    pepRelation: form.pepStatus ? form.pepRelation.trim() || null : null,
    npwp: form.npwp.trim() || null,
  };
}
