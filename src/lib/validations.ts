import {
  MIN_MINT_AMOUNT,
  MAX_MINT_AMOUNT,
  MIN_REDEEM_AMOUNT,
  MAX_REDEEM_AMOUNT,
} from "./constants";

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Invalid email format";
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
  if (!address.startsWith("0x")) return "Address must start with 0x";
  if (address.length !== 42) return "Invalid EVM address (must be 42 chars)";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return "Invalid EVM address format";
  return null;
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
