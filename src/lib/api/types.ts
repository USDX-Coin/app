import type { AmountCurrency, ConsumerOrderType, EntityType } from "@/types";

// ── Auth (openapi auth.yaml — Auth v2 / consumer) ──────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  entityType: EntityType; // INDIVIDUAL only in Week 1
  agreeToS: boolean;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}

// changePasswordV2 (auth.yaml, USDX-172) — in-app password change for a logged-in
// user. bearerAuth, unlike the public reset-password flow. Field naming mirrors
// ResetPasswordRequest so validators/error mapping stay shared.
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// ── KYC (openapi kyc.yaml — consumer) ──────────────────────────────────────
export type IdentityType = "KTP" | "DRIVER_LICENSE";

export interface SubmitKycRequest {
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  birthPlace: string;
  identityType: IdentityType;
  identityNumber: string;
  country: string; // ISO 3166-1 alpha-2; "ID" in Week 1
  addressLine1: string;
  addressLine2: string | null;
  ktpObjectKey: string;
  selfieObjectKey: string;
}

// ── Storage (openapi storage.yaml — consumer) ──────────────────────────────
export type PresignedDocKind = "ktp" | "selfie";

export interface PresignedUploadRequest {
  docKind: PresignedDocKind;
  fileType: string; // MIME, e.g. image/jpeg
  sizeBytes: number; // max 5_242_880
}

export interface PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
  headers?: Record<string, string>;
}

// ── Mint / Redeem (legacy W1-era mock shapes — used by the not-yet-migrated
// mint/redeem pages until USDX-201/W3 swap them) ───────────────────────────
export interface CreateMintRequest {
  chainId: string;
  amount: number;
  destinationAddress: string;
}

export interface CreateRedeemRequest {
  chainId: string;
  amount: number;
  bankAccountId: string;
  walletAddress: string;
}

// ── Phase 2 Week 2 — consumer mint v2 + address book (USDX-205) ─────────────
// Request bodies for the real `/api/v2/*` client modules (mint-api, address-book-api).
// openapi mint.yaml CreateMintOrderV2, address-book.yaml.

export interface CreateMintOrderRequest {
  userAddress: string; // EVM address (manual / address book); stored as-is
  amount: string; // decimal — USD = USDX amount, IDR = subtotal (mint value)
  amountCurrency: AmountCurrency;
  chain: string; // Phase 2 = Polygon-only → FE sends "polygon" (hardcoded)
}

export interface CreateAddressBookRequest {
  address: string;
  label: string; // max 50 chars
}

// ── Phase 2 Week 3 — consumer redeem v2 (USDX-243, hardened USDX-259) ────────
// POST /api/v2/redeem body (redeem.yaml CreateRedeemOrder). Bank fields are
// encrypted PII server-side; the FE sends them plaintext over TLS.
export interface CreateRedeemOrderRequest {
  amount: string; // decimal — USD = USDX amount (burned), IDR = gross_idr (sale value)
  amountCurrency: AmountCurrency;
  chain: string; // Phase 2 = Polygon-only → FE sends "polygon" (hardcoded)
  // Connected wallet that will burn (week3.md § Week 3 Addendum, USDX-259). The
  // backend binds the order to it (user_address), pre-checks balance + blacklist,
  // and the scanner only accepts a Redeem event from this address.
  userAddress: string;
  // Bank destination — two-path (redeem.yaml CreateRedeemOrder, USDX-262/267). Send
  // EXACTLY one path: `bankAccountId` (saved Bank Account Book entry — the backend
  // resolves + decrypts the number/name server-side, since GET only returns masked)
  // OR the manual trio below. `bankAccountId` is authoritative; `bankAccountNumber`
  // must never accompany it (→ 422 VALIDATION_ERROR), and `bankCode`/`bankAccountName`
  // sent alongside must match the entry. Omitted fields are dropped from the body.
  bankAccountId?: string; // saved path — entry id (bank-accounts.yaml)
  bankCode?: string; // manual path — destination bank (provider-specific code)
  bankAccountNumber?: string; // manual path — account number (plaintext over TLS)
  bankAccountName?: string; // manual path — holder name (plaintext over TLS)
}

// POST /api/v2/redeem/{id}/burn-tx body (redeem.yaml redeemV2BurnTx, USDX-259).
// FE reports the burn tx hash optimistically right after broadcast; status stays
// AWAITING_BURN (the scanner remains the source of truth for BURNED).
export interface ReportBurnTxRequest {
  txHash: string; // 0x-prefixed redeem tx hash
}

// POST /api/v2/bank-accounts body (bank-accounts.yaml CreateBankAccountEntry,
// USDX-261). account fields are encrypted PII server-side; sent plaintext over TLS.
export interface CreateBankAccountRequest {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  label?: string; // optional, max 50 chars
}

export interface ListTransactionsParams {
  page?: number;
  take?: number; // 1..50, default 10
  type?: ConsumerOrderType; // W2 effective MINT
}
