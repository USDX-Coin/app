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

// ── Phase 2 Week 2 — consumer mint / rate / address book / history (USDX-205) ──
// Mirrors the OpenAPI contract (rate.yaml, address-book.yaml, mint.yaml,
// transactions.yaml). Monetary values are decimal *strings* — the backend is
// authoritative; the FE never re-floats them. Status enums are the uppercase
// SoT values (conventions.md § Status Enums), distinct from the legacy lowercase
// `TransactionStatus`/`TransactionType` used by the W1-era mocked pages.

export type AmountCurrency = "USD" | "IDR";
export type PaymentChannel = "VA" | "QRIS";
export type VaBank =
  | "BCA"
  | "BNI"
  | "BRI"
  | "CIMB"
  | "DANAMON"
  | "INA"
  | "MANDIRI"
  | "PERMATA"
  | "MAYBANK";

// 3 separate status dimensions of a mint order.
export type MintPaymentStatus = "REQUESTED" | "WAITING_FOR_PAYMENT" | "PAID" | "EXPIRED";
export type MintSafeStatus = "NONE" | "PENDING_APPROVAL" | "APPROVED" | "EXECUTED" | "REJECTED";
export type MintOrderStatus = "WAITING_FOR_PAYMENT" | "WAITING_FOR_APPROVAL" | "COMPLETED" | "FAILED";

// Consumer order type (openapi TransactionType). W2 = MINT; REDEEM effective W3.
export type ConsumerOrderType = "MINT" | "REDEEM";

// GET /api/v2/rate — base + directional spread for the consumer mint preview.
export interface ConsumerRate {
  baseRate: string;
  spreadBuyPct: string;
  spreadSellPct: string;
  effectiveBuyRate: string; // FE uses this for the mint conversion preview
  updatedAt: string;
}

// address-book.yaml AddressBookEntry — a saved mint destination wallet.
export interface AddressBookEntry {
  id: string;
  address: string;
  label: string;
  createdAt: string;
}

// One payment channel offered at create-time (VA carries a bank list; QRIS does not).
export interface MintChannelOption {
  channel: PaymentChannel;
  pgFeeIdr: string;
  banks: VaBank[] | null;
}

// Step-1 (create) response. PG fee + total-to-pay only exist after a channel is
// chosen, so they live on `MintOrderDetail`, not here.
export interface MintOrderCreated {
  id: string;
  orderNumber: string;
  customerName: string;
  userAddress: string;
  chain: string;
  amount: string; // decimal USDX
  baseRate: string;
  spreadBuyPct: string;
  effectiveRate: string;
  subtotalIdr: string;
  mintFeeIdr: string;
  totalBeforePgFeeIdr: string; // "Total Pembayaran" before the PG service fee
  paymentStatus: MintPaymentStatus;
  safeStatus: MintSafeStatus;
  status: MintOrderStatus;
  expiresAt: string;
  channels: MintChannelOption[];
}

// Full mint order (GET detail / after /pay). FE view model — backend-only fields
// (idempotencyKey, amountWei, safeType) are omitted; estimated revenue is never
// exposed to the consumer (backoffice only).
export interface MintOrderDetail {
  id: string;
  orderNumber: string;
  customerName: string;
  type: ConsumerOrderType;
  userAddress: string;
  chain: string;
  inputCurrency: AmountCurrency;
  amount: string;
  baseRate: string;
  spreadBuyPct: string;
  effectiveRate: string;
  subtotalIdr: string;
  mintFeePct: string;
  mintFeeIdr: string;
  totalBeforePgFeeIdr: string;
  paymentChannel: PaymentChannel | null;
  pgFeeIdr: string | null;
  totalFeeIdr: string | null;
  totalPayIdr: string | null;
  paymentBank: VaBank | null;
  paymentStatus: MintPaymentStatus;
  safeStatus: MintSafeStatus;
  status: MintOrderStatus;
  paymentProvider: string;
  virtualAccountNo: string | null;
  paymentUrl: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  expiresAt: string;
  safeTxHash: string | null;
  onChainTxHash: string | null;
  createdAt: string;
  // Payment channel options + per-channel pg fee, needed by the checkout method
  // selector while REQUESTED. The CREATE response (MintOrderCreated) always
  // carries this; GET currently does NOT per OpenAPI — optional here so the
  // checkout falls back to a static VA/QRIS list on refresh. Backend gap flagged
  // to add `channels[]` to GET /v2/mint/{id} while paymentStatus=REQUESTED.
  channels?: MintChannelOption[];
  updatedAt: string;
}

// transactions.yaml TransactionItem — one history row. Mint-only in W2.
export interface ConsumerTransaction {
  id: string;
  type: ConsumerOrderType;
  amount: string;
  subtotalIdr: string;
  totalPayIdr: string | null;
  effectiveRate: string;
  chain: string;
  paymentStatus: MintPaymentStatus;
  status: MintOrderStatus;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
}
