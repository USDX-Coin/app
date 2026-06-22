import type {
  LoginRequest,
  RegisterRequest,
  VerifyEmailRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  SubmitKycRequest,
  PresignedUploadRequest,
  PresignedUploadResult,
  CreateMintRequest,
  CreateRedeemRequest,
  CreateMintOrderRequest,
  CreateRedeemOrderRequest,
  CreateAddressBookRequest,
  ListTransactionsParams,
} from "./types";
import type {
  AuthResponse,
  RegisterResult,
  KycMyStatus,
  MintOrder,
  RedeemOrder,
  Transaction,
  TransactionType,
  TransactionStatus,
  BankAccount,
  User,
  ConsumerRate,
  AddressBookEntry,
  MintChannelOption,
  MintOrderCreated,
  ConsumerTransaction,
  VaBank,
  AmountCurrency,
  RedeemOrderCreated,
  RedeemOrderDetail,
  RedeemStatus,
} from "@/types";
import { ApiError, type Paginated } from "./client";
import { validatePassword, validateAddress } from "@/lib/validations";
import { computeRedeemBreakdown } from "@/lib/redeem/fees";
import {
  REDEEM_FEE_PCT,
  DISBURSEMENT_FEE_FLAT_IDR,
  MIN_REDEEM_PAYOUT_IDR,
  USDX_DECIMALS,
} from "@/lib/constants";

// Simulated delay
function delay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Mock auth backend ──────────────────────────────────────────────────────
// In-memory stand-in for the real /api/v2/auth/* + /api/v2/kyc endpoints, used
// when `env.useMock` is true (no backend configured). Keeps `pnpm dev` and the
// test suite working offline. Demo creds: demo@usdx.com / Demo1234.

const DEMO_USER: User = {
  id: "usr_1",
  name: "Demo User",
  email: "demo@usdx.com",
  phone: "+628123456789",
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

interface MockAccount {
  password: string;
  user: User;
}

const accounts = new Map<string, MockAccount>([
  ["demo@usdx.com", { password: "Demo1234", user: DEMO_USER }],
]);

// Tracks the "logged-in" account so mock /me and /kyc/me stay coherent within a session.
let currentEmail: string | null = null;

function tokenFor(user: User): string {
  return "mock-jwt-token-" + user.id;
}

function currentAccount(): MockAccount | null {
  return currentEmail ? (accounts.get(currentEmail) ?? null) : null;
}

// Test seam (mirrors KYC_OVERRIDE_KEY): arm a 429 with an arbitrary Retry-After
// via localStorage ("usdx-mock-retry-after") so Playwright can exercise the
// human-readable duration formatting (USDX-167) — the real daily limits
// (forgot password 3x/hari → ~22h) are unreachable in an in-memory mock that
// resets per page load. Mock-only.
const RETRY_AFTER_OVERRIDE_KEY = "usdx-mock-retry-after";

function maybeThrowRateLimitOverride(code: "TOO_MANY_ATTEMPTS" | "TOO_MANY_REQUESTS"): void {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(RETRY_AFTER_OVERRIDE_KEY);
  if (raw === null) return;
  const seconds = Number(raw);
  throw new ApiError(
    429,
    code,
    "Too many requests",
    undefined,
    Number.isFinite(seconds) && seconds > 0 ? seconds : null,
  );
}

// Test seam (USDX-252): arm `429 RATE_LIMITED` (throughput throttle, distinct from
// the auth seam above) via localStorage ("usdx-mock-ratelimit" = Retry-After
// seconds) so the central throttle toast + poll backoff are exercisable offline —
// the real 5 req/s throttle (USDX-250) isn't reachable in a per-page-load mock.
// Armed → every mint/redeem create + status poll returns 429. Mock-only.
const RATE_LIMIT_OVERRIDE_KEY = "usdx-mock-ratelimit";

function maybeThrowRateLimited(): void {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(RATE_LIMIT_OVERRIDE_KEY);
  if (raw === null) return;
  const seconds = Number(raw);
  throw new ApiError(
    429,
    "RATE_LIMITED",
    "Terlalu banyak request, coba lagi sebentar",
    undefined,
    Number.isFinite(seconds) && seconds > 0 ? seconds : 1,
  );
}

// Rate-limit simulation (week1.md § Login: 5 wrong attempts per 15 min per email).
// Mirrors the real 429 TOO_MANY_ATTEMPTS so the FE cooldown countdown is testable
// offline. State is per page load (module scope), like the rest of the mock.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; firstAt: number }>();

export async function mockLogin(req: LoginRequest): Promise<AuthResponse> {
  await delay();
  maybeThrowRateLimitOverride("TOO_MANY_ATTEMPTS");
  const attempts = failedLogins.get(req.email);
  if (attempts && Date.now() - attempts.firstAt > LOGIN_WINDOW_MS) {
    failedLogins.delete(req.email);
  }
  if ((failedLogins.get(req.email)?.count ?? 0) >= LOGIN_MAX_ATTEMPTS) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many login attempts", undefined, 60);
  }
  const account = accounts.get(req.email);
  if (!account || account.password !== req.password) {
    const current = failedLogins.get(req.email) ?? { count: 0, firstAt: Date.now() };
    failedLogins.set(req.email, { ...current, count: current.count + 1 });
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  failedLogins.delete(req.email);
  if (!account.user.emailVerifiedAt) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Please verify your email first", {
      resendUrl: "/api/v2/auth/resend-verification",
    });
  }
  if (account.user.suspended) {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "Your account is suspended");
  }
  currentEmail = account.user.email;
  return { user: account.user, token: tokenFor(account.user) };
}

// Backend normalizes 08xxx → +62xxx before the phone_hash uniqueness check
// (week1.md § Self-Signup); mirror that so duplicates match across formats.
function normalizePhone(phone: string): string {
  return phone.startsWith("08") ? "+62" + phone.slice(1) : phone;
}

export async function mockRegister(req: RegisterRequest): Promise<RegisterResult> {
  await delay();
  if (accounts.has(req.email)) {
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email already registered");
  }
  const phone = normalizePhone(req.phone);
  if ([...accounts.values()].some((a) => a.user.phone === phone)) {
    throw new ApiError(409, "PHONE_ALREADY_REGISTERED", "Phone number already registered");
  }
  const now = new Date().toISOString();
  const user: User = {
    id: "usr_" + Date.now(),
    name: null,
    email: req.email,
    phone,
    entityType: req.entityType,
    kycStatus: "UNVERIFIED",
    suspended: false,
    emailVerifiedAt: null, // must verify email before login
    createdAt: now,
    updatedAt: now,
  };
  accounts.set(req.email, { password: req.password, user });
  return { email: req.email };
}

// Tokens the mock treats as bad, so invalid/expired-link flows are testable
// offline (real backend: 400 INVALID_TOKEN for unknown/expired/used tokens).
function assertMockTokenValid(token: string) {
  if (token === "expired-token" || token === "invalid-token") {
    throw new ApiError(400, "INVALID_TOKEN", "This link is invalid or has expired");
  }
}

// Mock verify-email: marks the most recently registered unverified account
// verified and issues a session (auto-login), mirroring the real contract.
export async function mockVerifyEmail(req: VerifyEmailRequest): Promise<AuthResponse> {
  await delay();
  assertMockTokenValid(req.token);
  const account =
    [...accounts.values()].reverse().find((a) => !a.user.emailVerifiedAt) ??
    accounts.get("demo@usdx.com")!;
  account.user.emailVerifiedAt = new Date().toISOString();
  currentEmail = account.user.email;
  return { user: account.user, token: tokenFor(account.user) };
}

export async function mockResendVerification(): Promise<void> {
  await delay(300);
  maybeThrowRateLimitOverride("TOO_MANY_REQUESTS");
}

export async function mockForgotPassword(): Promise<void> {
  await delay(300);
  maybeThrowRateLimitOverride("TOO_MANY_REQUESTS");
}

// Mock reset-password: verifies + auto-logs-in the most relevant account.
export async function mockResetPassword(req: ResetPasswordRequest): Promise<AuthResponse> {
  await delay();
  assertMockTokenValid(req.token);
  const account = currentAccount() ?? accounts.get("demo@usdx.com")!;
  account.user.emailVerifiedAt = account.user.emailVerifiedAt ?? new Date().toISOString();
  currentEmail = account.user.email;
  return { user: account.user, token: tokenFor(account.user) };
}

// Mock change-password (auth.yaml § changePasswordV2, USDX-172). Verifies the
// current password against the account's stored secret, then mutates it so a
// follow-up login with the new password works offline. Storage-seeded sessions
// (Playwright loginViaStorage) have no in-memory `currentEmail`, so we fall back
// to the demo account — its password (Demo1234) is what the AC tests against.
export async function mockChangePassword(req: ChangePasswordRequest): Promise<void> {
  await delay();
  maybeThrowRateLimitOverride("TOO_MANY_ATTEMPTS");
  const account = currentAccount() ?? accounts.get("demo@usdx.com")!;
  if (account.password !== req.currentPassword) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
  }
  // Client validates first; these mirror the backend so the fallback path is real.
  if (validatePassword(req.newPassword) !== null) {
    throw new ApiError(400, "WEAK_PASSWORD", "Password does not meet the policy");
  }
  if (req.newPassword !== req.confirmNewPassword) {
    throw new ApiError(400, "PASSWORD_MISMATCH", "Passwords do not match");
  }
  account.password = req.newPassword;
}

export async function mockLogout(): Promise<void> {
  await delay(150);
  currentEmail = null;
}

export async function mockGetMe(): Promise<User> {
  await delay(200);
  const account = currentAccount();
  if (account) return account.user;
  // Storage-seeded session (Playwright loginViaStorage): the in-memory mock has
  // no logged-in account, so mirror the persisted user instead of falling back
  // to DEMO_USER — otherwise the /v2/auth/me refresh (useSession) would
  // overwrite seeded state like `name: null` (USDX-153 header fallback tests).
  return persistedUser() ?? DEMO_USER;
}

function persistedUser(): User | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("usdx-auth");
    if (!raw) return null;
    return (JSON.parse(raw)?.state?.user as User) ?? null;
  } catch {
    return null;
  }
}

// ── Mock KYC backend ─────────────────────────────────────────────────────

const MOCK_REJECT_REASON = "Foto KTP buram, mohon submit ulang.";

// Test seam: the in-memory mock resets on every page load, so Playwright can't
// reach PENDING/REJECTED states across navigations. The override persists the
// simulated kyc_status in localStorage ("usdx-mock-kyc-status"); submit keeps it
// in sync (→ PENDING). Mock-only — the real backend owns this state.
const KYC_OVERRIDE_KEY = "usdx-mock-kyc-status";
const KYC_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;

function kycStatusOverride(): User["kycStatus"] | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(KYC_OVERRIDE_KEY);
  return (KYC_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as User["kycStatus"])
    : null;
}

function setKycStatusOverride(status: User["kycStatus"]) {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(KYC_OVERRIDE_KEY) === null) return; // seam not armed
  localStorage.setItem(KYC_OVERRIDE_KEY, status);
}

export async function mockGetMyKycStatus(): Promise<KycMyStatus> {
  await delay(200);
  const user = currentAccount()?.user ?? DEMO_USER;
  const status = kycStatusOverride() ?? user.kycStatus;
  if (status === "UNVERIFIED") {
    // Never submitted → status only, mirroring the backend fallback to
    // users.kyc_status (kyc.yaml § myStatus, USDX-147).
    return { status: "UNVERIFIED" };
  }
  return {
    status,
    submissionCount: 1,
    submittedAt: user.updatedAt,
    reviewedAt: status === "PENDING" ? null : user.updatedAt,
    rejectionReason: status === "REJECTED" ? MOCK_REJECT_REASON : null,
  };
}

export async function mockSubmitKyc(req: SubmitKycRequest): Promise<KycMyStatus> {
  await delay(800);
  const account = currentAccount();
  if (account) {
    account.user.kycStatus = "PENDING";
    account.user.name = account.user.name ?? `${req.firstName} ${req.lastName}`;
    account.user.updatedAt = new Date().toISOString();
  }
  setKycStatusOverride("PENDING");
  return { status: "PENDING", submissionCount: 1, submittedAt: new Date().toISOString(), reviewedAt: null, rejectionReason: null };
}

export async function mockPresignedUpload(req: PresignedUploadRequest): Promise<PresignedUploadResult> {
  await delay(300);
  const userId = currentAccount()?.user.id ?? "usr_demo";
  const objectKey = `kyc/${userId}/${req.docKind}/mock-${Date.now()}.jpg`;
  return {
    uploadUrl: `https://mock.bucket.local/${objectKey}`,
    objectKey,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    headers: { "Content-Type": req.fileType },
  };
}

// ── Mock transactions / mint / redeem (Week 2+, still mocked) ──────────────
export async function mockGetTransactions(): Promise<Transaction[]> {
  await delay(300);
  const types: TransactionType[] = ["mint", "redeem", "redeem", "bridge", "send", "mint", "bridge", "send"];
  const statuses: TransactionStatus[] = ["completed", "completed", "completed", "pending", "pending", "failed"];
  const chains = ["base", "polygon", "ethereum", "arbitrum", "bsc", "avalanche", "optimism"];
  const amounts = [240, 500, 1000, 2500, 750, 5000, 100, 3200, 1500, 8000];
  const base = new Date("2026-04-30T14:00:00Z").getTime();
  return Array.from({ length: 96 }, (_, i) => ({
    id: `tx_${String(i + 1).padStart(3, "0")}`,
    type: types[i % types.length],
    amount: amounts[i % amounts.length],
    chainId: chains[i % chains.length],
    status: statuses[i % statuses.length],
    txHash: `B9Qm4Y${(2_000_000 + i * 7919).toString(36)}WzPaQqjKoX`,
    createdAt: new Date(base - i * 7 * 3_600_000).toISOString(),
  }));
}

export async function mockCreateMint(
  req: CreateMintRequest
): Promise<MintOrder> {
  await delay(800);
  return {
    id: "mint_" + Date.now(),
    chainId: req.chainId,
    amount: req.amount,
    destinationAddress: req.destinationAddress,
    totalPaymentUsd: req.amount,
    fee: req.amount * 0.007,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export async function mockCreateRedeem(
  req: CreateRedeemRequest
): Promise<RedeemOrder> {
  await delay(1200);
  return {
    id: "redeem_" + Date.now(),
    chainId: req.chainId,
    amount: req.amount,
    bankAccountId: req.bankAccountId,
    totalReceiveUsd: req.amount - req.amount * 0.007,
    fee: req.amount * 0.007,
    status: "completed",
    txHash: "0x" + Math.random().toString(16).slice(2, 42),
    createdAt: new Date().toISOString(),
  };
}

export async function mockGetBankAccounts(): Promise<BankAccount[]> {
  await delay(200);
  return [
    {
      id: "bank_1",
      bankName: "Chase",
      accountNumber: "****4567",
      accountHolder: "Demo User",
    },
    {
      id: "bank_2",
      bankName: "Bank of America",
      accountNumber: "****8901",
      accountHolder: "Demo User",
    },
  ];
}

export async function mockGetWalletBalance(): Promise<number> {
  await delay(300);
  return 5000;
}

// ── Mock W2 consumer: rate / address book / mint v2 / history (USDX-205) ────
// New-shape mocks matching the Week-2 OpenAPI contract (rate.yaml,
// address-book.yaml, mint.yaml, transactions.yaml). They power the real-shaped
// client modules (rate-api/address-book-api/mint-api/transactions-api) when no
// backend is configured. The legacy `mockCreateMint`/`mockGetTransactions` above
// are no longer used by any page (mint → USDX-201, history → USDX-204) but stay
// for their unit tests until those legacy mocks are retired.

const MOCK_BASE_RATE = 16000;
const MOCK_SPREAD_BUY_PCT = 2.5;
const MOCK_SPREAD_SELL_PCT = 2.0;
const MOCK_MINT_FEE_PCT = 1; // % of subtotal
const MOCK_PG_FEE_VA = 4000; // flat IDR
const MOCK_PG_FEE_QRIS_PCT = 0.7; // % of subtotal
// Test seam: the real backend pre-checks `isBlackListed(userAddress)` on create
// and returns 422 RECIPIENT_BLACKLISTED (USDX-192, week2.md § Endpoints Mint).
// The mock mirrors that for this sentinel so the FE inline-error path (USDX-201)
// is exercisable offline.
export const MOCK_BLACKLISTED_ADDRESS = "0x000000000000000000000000000000000000dead";
const MOCK_MIN_TOTAL_PAY_IDR = 10_000; // Asasta floor (week2.md § Min amount)
const MOCK_VA_BANKS: VaBank[] = [
  "BCA", "BNI", "BRI", "CIMB", "DANAMON", "INA", "MANDIRI", "PERMATA", "MAYBANK",
];

const mockEffectiveBuyRate = () => MOCK_BASE_RATE * (1 + MOCK_SPREAD_BUY_PCT / 100);
const mockEffectiveSellRate = () => MOCK_BASE_RATE * (1 - MOCK_SPREAD_SELL_PCT / 100);
const idr = (n: number) => n.toFixed(2);

export async function mockGetConsumerRate(): Promise<ConsumerRate> {
  await delay(150);
  return {
    baseRate: idr(MOCK_BASE_RATE),
    spreadBuyPct: String(MOCK_SPREAD_BUY_PCT),
    spreadSellPct: String(MOCK_SPREAD_SELL_PCT),
    effectiveBuyRate: idr(mockEffectiveBuyRate()),
    effectiveSellRate: idr(mockEffectiveSellRate()),
    updatedAt: new Date().toISOString(),
  };
}

// In-memory address book (per page load, like the rest of the mock). Seeded with
// a couple of deterministic wallets so the mint "To" picker (USDX-201) isn't empty
// in dev. Seeds live in the same map so the add dup-check (409) and delete (USDX-203)
// cover them too — otherwise duplicates of a seed wouldn't 409 and seeds couldn't be
// deleted from the picker.
const addressBook = new Map<string, AddressBookEntry>([
  [
    "seed_addr_1",
    {
      id: "seed_addr_1",
      address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      label: "Demo Wallet",
      createdAt: "2026-06-10T08:00:00.000Z",
    },
  ],
  [
    "seed_addr_2",
    {
      id: "seed_addr_2",
      address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      label: "Cold Storage",
      createdAt: "2026-06-09T08:00:00.000Z",
    },
  ],
]);

export async function mockListAddressBook(): Promise<AddressBookEntry[]> {
  await delay(150);
  return [...addressBook.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function mockAddAddressBook(req: CreateAddressBookRequest): Promise<AddressBookEntry> {
  await delay(200);
  // v2 DTO validation → 422 VALIDATION_ERROR (conventions.md § Validation Error
  // (v2); USDX-213/214) — invalid EVM address or empty/over-50-char label. Mirrors
  // the backend pipe so the FE 422 path is real. Runs before the 409 duplicate
  // business check (validation precedes business logic).
  const label = req.label.trim();
  if (validateAddress(req.address.trim()) || label.length === 0 || label.length > 50) {
    throw new ApiError(422, "VALIDATION_ERROR", "Alamat atau label tidak valid");
  }
  const duplicate = [...addressBook.values()].some(
    (e) => e.address.toLowerCase() === req.address.toLowerCase(),
  );
  if (duplicate) {
    throw new ApiError(409, "ADDRESS_ALREADY_EXISTS", "Address sudah ada di buku alamat Anda");
  }
  const entry: AddressBookEntry = {
    id: "addr_" + Date.now(),
    address: req.address,
    label: req.label,
    createdAt: new Date().toISOString(),
  };
  addressBook.set(entry.id, entry);
  return entry;
}

export async function mockDeleteAddressBook(id: string): Promise<{ id: string }> {
  await delay(150);
  if (!addressBook.has(id)) throw new ApiError(404, "NOT_FOUND", "Entry tidak ditemukan");
  addressBook.delete(id);
  return { id };
}

// In-memory mint orders (mock) — feeds the consumer history list (USDX-204) agar
// order yang baru dibuat langsung muncul. Checkout (status tracker + pay) pindah ke
// repo `checkout` (USDX-224/225); mock di sini tidak lagi advance lifecycle atau
// melayani GET/pay — record cukup menyimpan field yang dibaca mapper history.
interface MockMintRecord extends MintOrderCreated {
  totalPayIdr: string | null;
  onChainTxHash: string | null;
  createdAt: string;
  updatedAt: string;
}
const mintOrders = new Map<string, MockMintRecord>();

export async function mockCreateMintOrder(req: CreateMintOrderRequest): Promise<MintOrderCreated> {
  await delay(600);
  maybeThrowRateLimited(); // 429 RATE_LIMITED seam (USDX-252)
  const rate = mockEffectiveBuyRate();
  const amountUsdx = req.amountCurrency === "USD" ? Number(req.amount) : Number(req.amount) / rate;
  const subtotalIdr = req.amountCurrency === "IDR" ? Number(req.amount) : amountUsdx * rate;
  const mintFeeIdr = subtotalIdr * (MOCK_MINT_FEE_PCT / 100);
  // Pre-checks mirroring the real backend (USDX-192): blacklist pre-check +
  // min total (cheapest channel) floor → 422 before any payment.
  if (req.userAddress.toLowerCase() === MOCK_BLACKLISTED_ADDRESS) {
    throw new ApiError(422, "RECIPIENT_BLACKLISTED", "Address tujuan tidak bisa menerima USDX");
  }
  const cheapestPgFee = Math.min(MOCK_PG_FEE_VA, subtotalIdr * (MOCK_PG_FEE_QRIS_PCT / 100));
  if (Math.floor(subtotalIdr + mintFeeIdr + cheapestPgFee) < MOCK_MIN_TOTAL_PAY_IDR) {
    throw new ApiError(422, "VALIDATION_ERROR", "Total pembayaran minimal Rp10.000");
  }
  const id = "mint_" + Date.now();
  const nowIso = new Date().toISOString();
  const channels: MintChannelOption[] = [
    { channel: "VA", pgFeeIdr: idr(MOCK_PG_FEE_VA), banks: MOCK_VA_BANKS },
    { channel: "QRIS", pgFeeIdr: idr(subtotalIdr * (MOCK_PG_FEE_QRIS_PCT / 100)), banks: null },
  ];
  const created: MintOrderCreated = {
    id,
    orderNumber: "USDX-" + String(Date.now()).slice(-8),
    customerName: currentAccount()?.user.name ?? "Demo User",
    userAddress: req.userAddress,
    chain: req.chain || "polygon",
    amount: idr(amountUsdx),
    baseRate: idr(MOCK_BASE_RATE),
    spreadBuyPct: String(MOCK_SPREAD_BUY_PCT),
    effectiveRate: idr(rate),
    subtotalIdr: idr(subtotalIdr),
    mintFeeIdr: idr(mintFeeIdr),
    totalBeforePgFeeIdr: idr(subtotalIdr + mintFeeIdr),
    paymentStatus: "REQUESTED",
    safeStatus: "NONE",
    status: "WAITING_FOR_PAYMENT",
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    channels,
  };
  // Order tetap REQUESTED di mock app — progres pembayaran/on-chain ditangani repo
  // checkout + job backend, bukan di sini. Disimpan agar muncul di history.
  mintOrders.set(id, {
    ...created,
    totalPayIdr: null,
    onChainTxHash: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return created;
}

function mintRecordToTransaction(order: MockMintRecord): ConsumerTransaction {
  return {
    id: order.id,
    type: "MINT",
    amount: order.amount,
    subtotalIdr: order.subtotalIdr,
    grossIdr: null, // redeem-only
    totalPayIdr: order.totalPayIdr,
    netPayoutIdr: null, // redeem-only
    effectiveRate: order.effectiveRate,
    chain: order.chain,
    paymentStatus: order.paymentStatus,
    status: order.status,
    txHash: order.onChainTxHash,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// A few deterministic completed mint rows so /history (USDX-204) isn't empty in
// mock dev before the user creates any order this session.
function seededTransactions(): ConsumerTransaction[] {
  const base = new Date("2026-06-10T09:00:00Z").getTime();
  const amounts = [100, 250, 500, 1000, 75, 320];
  return amounts.map((usdx, i) => {
    const subtotal = usdx * mockEffectiveBuyRate();
    return {
      id: `seed_tx_${String(i + 1).padStart(3, "0")}`,
      type: "MINT" as const,
      amount: idr(usdx),
      subtotalIdr: idr(subtotal),
      grossIdr: null,
      totalPayIdr: idr(Math.floor(subtotal * 1.017)),
      netPayoutIdr: null,
      effectiveRate: idr(mockEffectiveBuyRate()),
      chain: "polygon",
      paymentStatus: "PAID" as const,
      status: "COMPLETED" as const,
      txHash: "0x" + (2_000_000 + i * 7919).toString(16).padStart(64, "0").slice(0, 64),
      createdAt: new Date(base - i * 6 * 3_600_000).toISOString(),
      updatedAt: new Date(base - i * 6 * 3_600_000).toISOString(),
    };
  });
}

export async function mockListConsumerTransactions(
  params: ListTransactionsParams = {},
): Promise<Paginated<ConsumerTransaction>> {
  await delay(250);
  const page = params.page ?? 1;
  const take = params.take ?? 10;
  const all = [
    ...[...mintOrders.values()].map(mintRecordToTransaction),
    ...seededTransactions(),
    ...[...redeemOrders.values()].map(redeemRecordToTransaction),
    ...seededRedeemTransactions(),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = params.type ? all.filter((t) => t.type === params.type) : all;
  const start = (page - 1) * take;
  return {
    data: filtered.slice(start, start + take),
    metadata: { page, limit: take, total: filtered.length },
  };
}

// ── Mock W3 consumer: redeem (USDX-243) ─────────────────────────────────────
// Simulates the redeem lifecycle that the status tracker polls. The burn is
// *real on-chain* in W3-real (Polygon), but here it's simulated end-to-end:
// create → broadcast (mockBroadcastRedeemBurn, stands in for sign + on-chain
// Redeem event + Event Scanner) → status derived from timestamps (mirrors the
// W2 mint mock deriving from expires_at, and the real Disbursement Trigger
// auto-completing after MOCK_DISBURSEMENT_AUTO_COMPLETE_DELAY). Real burn + real
// API land in INT-1 (USDX-249).

const MOCK_USDX_CONTRACT = "0x1eaed5000000000000000000000000000000d5e5"; // USDX proxy (mock, Polygon)
const MOCK_REDEEM_BURN_TTL_MS = 30 * 60_000; // week3.md REDEEM_BURN_TTL default (30 min)
const MOCK_BURNED_VISIBLE_MS = 2_500; // how long BURNED shows before payout starts
const MOCK_PAYOUT_COMPLETE_MS = 6_000; // PROCESSING_PAYOUT → PAYOUT_COMPLETE after this
// Test seam: a redeem to this account number fails inquiry → 422
// INVALID_BANK_ACCOUNT (week3.md § Validasi rekening), so the FE inline-error
// path is exercisable offline. Any other number passes (mock inquiry always valid).
export const MOCK_INVALID_BANK_ACCOUNT = "0000000000";

interface MockRedeemRecord {
  order: RedeemOrderCreated; // create-time snapshot (immutable money/bank fields)
  inputCurrency: AmountCurrency;
  bankAccountNumber: string; // plaintext kept only to derive payoutRef determinism; never returned
  createdAtMs: number;
  expiresAtMs: number;
  burnedAtMs: number | null;
  burnTxHash: string | null;
  userAddress: string | null;
}
const redeemOrders = new Map<string, MockRedeemRecord>();

function randomHex(bytes: number): string {
  let hex = "";
  for (let i = 0; i < bytes * 2; i++) hex += Math.floor(Math.random() * 16).toString(16);
  return hex;
}

function maskAccount(accountNumber: string): string {
  return "••••••" + accountNumber.slice(-4);
}

// 6-decimal USDX → uint256 micro-units string ("100" → "100000000").
function toUsdxWei(amountUsdx: number): string {
  return BigInt(Math.round(amountUsdx * 10 ** USDX_DECIMALS)).toString();
}

export async function mockCreateRedeemOrder(
  req: CreateRedeemOrderRequest,
): Promise<RedeemOrderCreated> {
  await delay(600);
  maybeThrowRateLimited(); // 429 RATE_LIMITED seam (USDX-252)
  // Account inquiry (week3.md § Validasi rekening) runs before burn — invalid
  // rekening rejected up front so no USDX is burned without a valid payout target.
  if (req.bankAccountNumber === MOCK_INVALID_BANK_ACCOUNT) {
    throw new ApiError(422, "INVALID_BANK_ACCOUNT", "Rekening tujuan tidak valid atau tidak ditemukan");
  }
  const rate = mockEffectiveSellRate();
  const b = computeRedeemBreakdown({
    amount: Number(req.amount),
    amountCurrency: req.amountCurrency,
    effectiveSellRate: rate,
    redeemFeePct: REDEEM_FEE_PCT,
    disbursementFeeFlatIdr: DISBURSEMENT_FEE_FLAT_IDR,
  });
  // Minimum payout floor checked from create (week3.md § Min payout) → reject
  // before the user burns.
  if (b.netPayoutIdr < MIN_REDEEM_PAYOUT_IDR) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      `Jumlah diterima minimal Rp${MIN_REDEEM_PAYOUT_IDR.toLocaleString("id-ID")}`,
    );
  }
  const nowMs = Date.now();
  const id = "rdm_" + nowMs;
  const order: RedeemOrderCreated = {
    id,
    orderNumber: "RDM" + nowMs.toString(36).toUpperCase(),
    customerName: currentAccount()?.user.name ?? "Demo User",
    chain: req.chain || "polygon",
    contractAddress: MOCK_USDX_CONTRACT,
    redeemId: "0x" + randomHex(32),
    amount: String(req.amountCurrency === "USD" ? Number(req.amount) : b.amountUsdx),
    amountWei: toUsdxWei(b.amountUsdx),
    baseRate: idr(MOCK_BASE_RATE),
    spreadSellPct: String(MOCK_SPREAD_SELL_PCT),
    effectiveRate: idr(rate),
    grossIdr: idr(b.grossIdr),
    redeemFeePct: String(REDEEM_FEE_PCT),
    redeemFeeIdr: idr(b.redeemFeeIdr),
    disbursementFeeIdr: idr(b.disbursementFeeIdr),
    totalFeeIdr: idr(b.totalFeeIdr),
    netPayoutIdr: idr(b.netPayoutIdr),
    bankCode: req.bankCode,
    bankAccountNumberMasked: maskAccount(req.bankAccountNumber),
    bankAccountName: req.bankAccountName,
    status: "AWAITING_BURN",
    expiresAt: new Date(nowMs + MOCK_REDEEM_BURN_TTL_MS).toISOString(),
  };
  redeemOrders.set(id, {
    order,
    inputCurrency: req.amountCurrency,
    bankAccountNumber: req.bankAccountNumber,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + MOCK_REDEEM_BURN_TTL_MS,
    burnedAtMs: null,
    burnTxHash: null,
    userAddress: null,
  });
  return order;
}

// Stands in for: user signs `redeem(redeemId, amountWei)` from their wallet →
// broadcast → backend Redeem Event Scanner marks the order BURNED. In W3-real
// the FE just broadcasts and the real scanner advances the order; this mock call
// exists only so the offline status tracker can progress. `fromAddress` is the
// connected wallet (real, even in mock mode).
export async function mockBroadcastRedeemBurn(
  redeemId: string,
  fromAddress: string,
): Promise<{ burnTxHash: string }> {
  await delay(400);
  const record = [...redeemOrders.values()].find((r) => r.order.redeemId === redeemId);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Redeem order tidak ditemukan");
  // Idempotent: a re-broadcast keeps the first burn (week3.md § Scanner idempotent).
  if (!record.burnedAtMs) {
    record.burnedAtMs = Date.now();
    record.burnTxHash = "0x" + randomHex(32);
    record.userAddress = fromAddress;
  }
  return { burnTxHash: record.burnTxHash! };
}

// Derives the live status + payout fields from elapsed time since the burn,
// mirroring the W3 job lifecycle (BURNED → PROCESSING_PAYOUT → PAYOUT_COMPLETE).
function resolveRedeemDetail(record: MockRedeemRecord): RedeemOrderDetail {
  const { order, burnedAtMs, expiresAtMs } = record;
  let status: RedeemStatus;
  let payoutRef: string | null = null;
  let payoutCompletedAt: string | null = null;

  if (burnedAtMs == null) {
    status = Date.now() > expiresAtMs ? "EXPIRED" : "AWAITING_BURN";
  } else {
    const elapsed = Date.now() - burnedAtMs;
    if (elapsed < MOCK_BURNED_VISIBLE_MS) {
      status = "BURNED";
    } else if (elapsed < MOCK_PAYOUT_COMPLETE_MS) {
      status = "PROCESSING_PAYOUT";
      payoutRef = "MOCK-" + order.orderNumber;
    } else {
      status = "PAYOUT_COMPLETE";
      payoutRef = "MOCK-" + order.orderNumber;
      payoutCompletedAt = new Date(burnedAtMs + MOCK_PAYOUT_COMPLETE_MS).toISOString();
    }
  }
  // Late burn: a burn detected after the order had already EXPIRED still pays out.
  const lateBurn = burnedAtMs != null && burnedAtMs > expiresAtMs;
  const burnedAt = burnedAtMs != null ? new Date(burnedAtMs).toISOString() : null;
  const nowIso = new Date().toISOString();

  return {
    ...order,
    status,
    type: "REDEEM",
    userAddress: record.userAddress,
    inputCurrency: record.inputCurrency,
    lateBurn,
    payoutProvider: "MOCK",
    payoutRef,
    burnTxHash: record.burnTxHash,
    burnedAt,
    payoutCompletedAt,
    createdAt: new Date(record.createdAtMs).toISOString(),
    updatedAt: nowIso,
  };
}

export async function mockGetRedeemOrder(id: string): Promise<RedeemOrderDetail> {
  await delay(250);
  maybeThrowRateLimited(); // 429 RATE_LIMITED seam (USDX-252)
  const record = redeemOrders.get(id);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Redeem order tidak ditemukan");
  return resolveRedeemDetail(record);
}

// ── Mock W3: redeem rows in the union history list (USDX-244) ───────────────
// `GET /v2/transactions` is union mint + redeem. Map any redeem orders created
// this session, plus a few seeded rows (various RedeemStatus) so /history shows
// redeem in mock dev before the user redeems. REDEEM rows fill grossIdr +
// netPayoutIdr + status (RedeemStatus); txHash = burn hash.
function redeemRecordToTransaction(record: MockRedeemRecord): ConsumerTransaction {
  const d = resolveRedeemDetail(record);
  return {
    id: d.id,
    type: "REDEEM",
    amount: d.amount,
    subtotalIdr: null, // mint-only
    grossIdr: d.grossIdr,
    totalPayIdr: null, // mint-only
    netPayoutIdr: d.netPayoutIdr,
    effectiveRate: d.effectiveRate,
    chain: d.chain,
    paymentStatus: null, // mint-only
    status: d.status,
    txHash: d.burnTxHash,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function seededRedeemTransactions(): ConsumerTransaction[] {
  const base = new Date("2026-06-11T09:00:00Z").getTime();
  const rate = mockEffectiveSellRate();
  const seeds: { usdx: number; status: RedeemStatus; burned: boolean }[] = [
    { usdx: 100, status: "PAYOUT_COMPLETE", burned: true },
    { usdx: 250, status: "PROCESSING_PAYOUT", burned: true },
    { usdx: 50, status: "AWAITING_BURN", burned: false },
    { usdx: 500, status: "EXPIRED", burned: false },
  ];
  return seeds.map((s, i) => {
    const gross = s.usdx * rate;
    const net = Math.floor(gross - (gross * (REDEEM_FEE_PCT / 100) + DISBURSEMENT_FEE_FLAT_IDR));
    return {
      id: `seed_rdm_${String(i + 1).padStart(3, "0")}`,
      type: "REDEEM" as const,
      amount: idr(s.usdx),
      subtotalIdr: null,
      grossIdr: idr(gross),
      totalPayIdr: null,
      netPayoutIdr: idr(net),
      effectiveRate: idr(rate),
      chain: "polygon",
      paymentStatus: null,
      status: s.status,
      txHash: s.burned
        ? "0x" + (3_000_000 + i * 7919).toString(16).padStart(64, "0").slice(0, 64)
        : null,
      createdAt: new Date(base - i * 5 * 3_600_000).toISOString(),
      updatedAt: new Date(base - i * 5 * 3_600_000).toISOString(),
    };
  });
}
