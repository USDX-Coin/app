import type { EntityType } from "@/types";

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

// ── Mint / Redeem (W2+, still mocked) ──────────────────────────────────────
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
