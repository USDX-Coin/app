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
// Redeem is a single form view + a polling status tracker (USDX-243). The
// Ringkasan is a modal over the form (like mint), so there's no in-page
// confirmation step — `form` collects input, `tracker` polls the order status.
export type RedeemStep = "form" | "tracker";

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

// GET /api/v2/rate — base + directional spread for the consumer preview.
// Mint previews with `effectiveBuyRate`, redeem (W3) with `effectiveSellRate`
// (rate.yaml § ConsumerRate). The final transaction value is re-snapshotted by
// the backend at order create — the FE never re-floats these.
export interface ConsumerRate {
  baseRate: string;
  spreadBuyPct: string;
  spreadSellPct: string;
  effectiveBuyRate: string; // baseRate × (1 + spreadBuyPct/100); mint preview
  effectiveSellRate: string; // baseRate × (1 − spreadSellPct/100); redeem preview
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

// Step-1 (create) response — satu-satunya bentuk order yang app pakai sekarang
// (pay + status detail dipegang repo `checkout`, USDX-225). PG fee + total-to-pay
// baru muncul setelah pilih channel di checkout, jadi tidak ada di sini.
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

// ── Phase 2 Week 3 — consumer redeem (USDX-243, redeem.yaml) ───────────────
// Redeem burns USDX on-chain (user self-signs) → IDR disbursed to the user's
// bank. The app builds the flow against the OpenAPI contract; the real on-chain
// burn + real API land in INT-1 (USDX-249). Monetary values are decimal strings
// (backend authoritative). Status enum = conventions.md § Status Enums → Redeem.
export type RedeemStatus =
  | "AWAITING_BURN" // order created, waiting for the on-chain burn
  | "BURNED" // Redeem event detected (amount matched)
  | "PROCESSING_PAYOUT" // disbursement created with the provider
  | "PAYOUT_COMPLETE" // payout confirmed
  | "EXPIRED"; // AWAITING_BURN passed expires_at without a burn (late burn → BURNED)

// POST /api/v2/redeem response (redeem.yaml RedeemOrderCreated). Carries the
// on-chain args the FE needs to build the burn tx `redeem(redeemId, amountWei)`.
export interface RedeemOrderCreated {
  id: string;
  orderNumber: string; // = partner_reference_no (prefix RDM)
  customerName: string;
  chain: string;
  contractAddress: string; // USDX proxy address on this chain
  redeemId: string; // bytes32 hex (0x-prefixed) — `id` arg for redeem(id, amount)
  amount: string; // decimal USDX
  amountWei: string; // uint256 string — `amount` arg for redeem(id, amount)
  baseRate: string;
  spreadSellPct: string;
  effectiveRate: string; // baseRate × (1 − spreadSellPct/100); = rateUsed
  grossIdr: string; // amount × effectiveRate (before fee)
  redeemFeePct: string;
  redeemFeeIdr: string;
  disbursementFeeIdr: string; // = provider service fee (reference in W3)
  totalFeeIdr: string; // redeemFeeIdr + disbursementFeeIdr
  netPayoutIdr: string; // grossIdr − totalFeeIdr (user receives; ≥ Rp 10.000, floor)
  bankCode: string;
  bankAccountNumberMasked: string; // last 4 digits; plaintext never returned
  bankAccountName: string; // user sees their own data
  status: RedeemStatus;
  expiresAt: string;
}

// GET /api/v2/redeem/{id} — full order + live status (redeem.yaml RedeemOrder).
// Adds the on-chain / payout fields the status tracker polls. estimatedRevenue is
// backoffice-only and intentionally absent here.
export interface RedeemOrderDetail extends RedeemOrderCreated {
  type: ConsumerOrderType;
  userAddress: string | null; // burn source wallet (set from the Redeem event at BURNED)
  inputCurrency: AmountCurrency;
  lateBurn: boolean;
  payoutProvider: string; // MOCK in W3
  payoutRef: string | null;
  burnTxHash: string | null;
  burnedAt: string | null;
  payoutCompletedAt: string | null;
  createdAt: string;
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
