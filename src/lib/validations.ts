import {
  MIN_MINT_AMOUNT,
  MAX_MINT_AMOUNT,
  MIN_REDEEM_AMOUNT,
  MAX_REDEEM_AMOUNT,
} from "./constants";
import { formatAmount } from "./utils";

// Every validator returns an **i18n key**, never a sentence (finding D1: the
// hardcoded English strings this file used to return landed verbatim in a UI
// that is otherwise entirely Indonesian). The component that renders the message
// translates it — directly with `t(key)`, or with `translateValidation(t, key)`
// when the message carries a number that lives in `constants.ts`.
//
// The return type stays `string | null` so `!error` keeps meaning "valid" at
// every call site, including the ones that only test the result for truthiness.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// Indonesian mobile: +62xxx or 08xxx (backend normalizes to +62xxx).
// sot/phase-2/week1.md § Self-Signup. Accept optional leading + then digits.
const PHONE_REGEX = /^(\+62|62|0)8[0-9]{7,13}$/;

export const PASSWORD_MIN_LENGTH = 8;

export function validateEmail(email: string): string | null {
  if (!email) return "validation.email.required";
  if (!EMAIL_REGEX.test(email)) return "validation.email.format";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "validation.password.required";
  if (password.length < PASSWORD_MIN_LENGTH) return "validation.password.minLength";
  if (!/[A-Z]/.test(password)) return "validation.password.uppercase";
  if (!/[a-z]/.test(password)) return "validation.password.lowercase";
  if (!/[0-9]/.test(password)) return "validation.password.number";
  return null;
}

// The four rules `PasswordStrength` lights a segment for, in the same order the
// validator checks them. The bar and the error message must never disagree, so
// they read from one list.
const PASSWORD_RULES: ((value: string) => boolean)[] = [
  (v) => v.length >= PASSWORD_MIN_LENGTH,
  (v) => /[A-Z]/.test(v),
  (v) => /[a-z]/.test(v),
  (v) => /[0-9]/.test(v),
];

export const PASSWORD_RULE_COUNT = PASSWORD_RULES.length;

/** How many password rules the value already satisfies, 0–4. */
export function passwordScore(password: string): number {
  if (!password) return 0;
  return PASSWORD_RULES.filter((rule) => rule(password)).length;
}

export function validateAmount(
  amount: string,
  type: "mint" | "redeem"
): string | null {
  if (!amount || amount.trim() === "") return "validation.amount.required";
  const cleaned = amount.replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "validation.amount.invalid";
  if (num <= 0) return "validation.amount.positive";

  const min = type === "mint" ? MIN_MINT_AMOUNT : MIN_REDEEM_AMOUNT;
  const max = type === "mint" ? MAX_MINT_AMOUNT : MAX_REDEEM_AMOUNT;

  // Mint and redeem get their own keys because the bound is part of the
  // message; one key with a caller-supplied number would let the two drift.
  if (num < min) return type === "mint" ? "validation.amount.minMint" : "validation.amount.minRedeem";
  if (num > max) return type === "mint" ? "validation.amount.maxMint" : "validation.amount.maxRedeem";
  return null;
}

export function validateAddress(address: string): string | null {
  if (!address) return "validation.address.required";
  if (address.startsWith("0x")) {
    if (address.length !== 42) return "validation.address.evmLength";
    if (!EVM_ADDRESS_REGEX.test(address)) return "validation.address.evmFormat";
  } else {
    if (address.length < 32 || address.length > 44) return "validation.address.solanaLength";
    if (!SOLANA_ADDRESS_REGEX.test(address)) return "validation.address.solanaFormat";
  }
  return null;
}

// Extract a wallet address from a scanned QR payload (USDX-217). Accepts a bare
// EVM address or an EIP-681 payment URI ("ethereum:0x…[@chainId][/path]?…").
// Returns a valid checksum-insensitive EVM address, or null if the payload isn't one.
export function parseScannedAddress(raw: string): string | null {
  if (!raw) return null;
  const text = raw.trim();
  const match = text.match(/^(?:ethereum:)?(?:pay-)?(0x[0-9a-fA-F]{40})\b/);
  const candidate = match ? match[1] : text;
  return EVM_ADDRESS_REGEX.test(candidate) ? candidate : null;
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string
): string | null {
  if (!confirmPassword) return "validation.confirmPassword.required";
  if (password !== confirmPassword) return "validation.confirmPassword.mismatch";
  return null;
}

export function validateFullName(name: string): string | null {
  if (!name || name.trim() === "") return "validation.fullName.required";
  if (name.trim().length < 2) return "validation.fullName.minLength";
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone || phone.trim() === "") return "validation.phone.required";
  const cleaned = phone.replace(/[\s-]/g, "");
  if (!PHONE_REGEX.test(cleaned)) return "validation.phone.format";
  return null;
}

// Redeem destination bank account (USDX-243). Number is digits-only (6–20);
// holder name is free text. The backend re-validates via the provider inquiry
// (422 INVALID_BANK_ACCOUNT) — these are the up-front field checks.
export function validateBankAccountNumber(value: string): string | null {
  if (!value || value.trim() === "") return "validation.bankAccountNumber.required";
  if (!/^[0-9]{6,20}$/.test(value.trim())) return "validation.bankAccountNumber.digits";
  return null;
}

export function validateBankAccountName(value: string): string | null {
  if (!value || value.trim() === "") return "validation.bankAccountName.required";
  if (value.trim().length < 2) return "validation.bankAccountName.minLength";
  return null;
}

// Numbers that belong to a message live here, not in the dictionary: the bounds
// come from `constants.ts` and copying them into two language files is how the
// copy and the rule drift apart. `formatAmount` is the same formatter the amount
// on screen uses, so the limit in the error reads like the figure above it.
const VALIDATION_VARS: Record<string, Record<string, string>> = {
  "validation.password.minLength": { min: String(PASSWORD_MIN_LENGTH) },
  "validation.amount.minMint": { amount: formatAmount(MIN_MINT_AMOUNT) },
  "validation.amount.maxMint": { amount: formatAmount(MAX_MINT_AMOUNT) },
  "validation.amount.minRedeem": { amount: formatAmount(MIN_REDEEM_AMOUNT) },
  "validation.amount.maxRedeem": { amount: formatAmount(MAX_REDEEM_AMOUNT) },
};

/**
 * Turn a validator's key into the sentence the user reads. Pass the `t` from
 * `useLang()`; a null key stays null so `{error && …}` keeps working.
 */
export function translateValidation(
  t: (key: string, vars?: Record<string, string>) => string,
  key: string | null | undefined
): string | null {
  if (!key) return null;
  return t(key, VALIDATION_VARS[key]);
}
