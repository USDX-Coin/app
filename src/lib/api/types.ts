import type { AmountCurrency, ConsumerOrderType, EntityType, PaymentChannel, VaBank } from "@/types";

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
// openapi mint.yaml CreateMintOrderV2 / PayMintOrderRequest, address-book.yaml.

export interface CreateMintOrderRequest {
  userAddress: string; // EVM address (manual / address book); stored as-is
  amount: string; // decimal — USD = USDX amount, IDR = subtotal (mint value)
  amountCurrency: AmountCurrency;
  chain: string; // Phase 2 = Polygon-only → FE sends "polygon" (hardcoded)
}

export interface PayMintOrderRequest {
  channel: PaymentChannel;
  bank?: VaBank | null; // required when channel = VA, ignored for QRIS
}

export interface CreateAddressBookRequest {
  address: string;
  label: string; // max 50 chars
}

export interface ListTransactionsParams {
  page?: number;
  take?: number; // 1..50, default 10
  type?: ConsumerOrderType; // W2 effective MINT
}
