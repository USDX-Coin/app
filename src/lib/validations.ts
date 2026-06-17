import {
  MIN_MINT_AMOUNT,
  MAX_MINT_AMOUNT,
  MIN_REDEEM_AMOUNT,
  MAX_REDEEM_AMOUNT,
} from "./constants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// Indonesian mobile: +62xxx or 08xxx (backend normalizes to +62xxx).
// sot/phase-2/week1.md § Self-Signup. Accept optional leading + then digits.
const PHONE_REGEX = /^(\+62|62|0)8[0-9]{7,13}$/;

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (!EMAIL_REGEX.test(email)) return "Invalid email format";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

export function validateAmount(
  amount: string,
  type: "mint" | "redeem"
): string | null {
  if (!amount || amount.trim() === "") return "Amount is required";
  const cleaned = amount.replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "Invalid amount";
  if (num <= 0) return "Amount must be greater than 0";

  const min = type === "mint" ? MIN_MINT_AMOUNT : MIN_REDEEM_AMOUNT;
  const max = type === "mint" ? MAX_MINT_AMOUNT : MAX_REDEEM_AMOUNT;

  if (num < min) return `Minimum amount is ${min} USDX`;
  if (num > max) return `Maximum amount is ${max.toLocaleString()} USDX`;
  return null;
}

export function validateAddress(address: string): string | null {
  if (!address) return "Destination address is required";
  if (address.startsWith("0x")) {
    if (address.length !== 42) return "Invalid EVM address (must be 42 chars)";
    if (!EVM_ADDRESS_REGEX.test(address)) return "Invalid EVM address format";
  } else {
    if (address.length < 32 || address.length > 44) return "Invalid Solana address";
    if (!SOLANA_ADDRESS_REGEX.test(address)) return "Invalid Solana address format";
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
  if (!confirmPassword) return "Please confirm your password";
  if (password !== confirmPassword) return "Passwords do not match";
  return null;
}

export function validateFullName(name: string): string | null {
  if (!name || name.trim() === "") return "Full name is required";
  if (name.trim().length < 2) return "Name must be at least 2 characters";
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone || phone.trim() === "") return "Phone number is required";
  const cleaned = phone.replace(/[\s-]/g, "");
  if (!PHONE_REGEX.test(cleaned)) return "Enter a valid Indonesian number (+62… or 08…)";
  return null;
}
