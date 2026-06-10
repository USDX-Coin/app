// Consumer user — mirrors openapi `User` (users.yaml) returned by GET /api/v2/auth/me.
export type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type EntityType = "INDIVIDUAL" | "LEGAL_ENTITY";

export interface User {
  id: string;
  // Null until KYC submit (self-signup users don't provide a name at register).
  name: string | null;
  email: string;
  phone: string | null;
  entityType: EntityType;
  kycStatus: KycStatus;
  suspended: boolean;
  // Null = email not yet verified.
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Own KYC status (consumer) — openapi KycMyStatus (kyc.yaml). No PII payload.
// Fields besides `status` are absent when the user has never submitted KYC —
// the backend falls back to users.kyc_status only (kyc.yaml § myStatus, USDX-147).
export interface KycMyStatus {
  status: KycStatus;
  submissionCount?: number | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
}

export interface Chain {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  contractAddress: string;
  explorerUrl: string;
}

export interface MintFormData {
  chainId: string;
  amount: string;
  destinationAddress: string;
}

export interface RedeemFormData {
  chainId: string;
  amount: string;
  bankAccountId: string;
}

export interface MintOrder {
  id: string;
  chainId: string;
  amount: number;
  destinationAddress: string;
  totalPaymentUsd: number;
  fee: number;
  status: TransactionStatus;
  createdAt: string;
}

export interface RedeemOrder {
  id: string;
  chainId: string;
  amount: number;
  bankAccountId: string;
  totalReceiveUsd: number;
  fee: number;
  status: TransactionStatus;
  txHash: string;
  createdAt: string;
}

export type TransactionStatus = "pending" | "completed" | "failed";
export type TransactionType = "mint" | "redeem" | "bridge" | "send";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  chainId: string;
  status: TransactionStatus;
  txHash: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

// Normalized session result used app-side. `token` is the Bearer credential
// (openapi AuthTokenV2.accessToken, falling back to sessionId for cookie audiences).
export interface AuthResponse {
  user: User;
  token: string;
}

// Result of POST /api/v2/auth/register — no session issued (user must verify email first).
export interface RegisterResult {
  email: string;
}

export type MintStep = "form" | "confirmation" | "status";
export type RedeemStep = "form" | "confirmation" | "status";
