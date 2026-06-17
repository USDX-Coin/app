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
  PayMintOrderRequest,
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
  MintOrderDetail,
  ConsumerTransaction,
  VaBank,
} from "@/types";
import { ApiError, type Paginated } from "./client";
import { validatePassword, validateAddress } from "@/lib/validations";

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
const idr = (n: number) => n.toFixed(2);

export async function mockGetConsumerRate(): Promise<ConsumerRate> {
  await delay(150);
  return {
    baseRate: idr(MOCK_BASE_RATE),
    spreadBuyPct: String(MOCK_SPREAD_BUY_PCT),
    spreadSellPct: String(MOCK_SPREAD_SELL_PCT),
    effectiveBuyRate: idr(mockEffectiveBuyRate()),
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

// In-memory mint orders + a coarse lifecycle so the checkout status tracker
// (USDX-202) has something to poll: after /pay the order auto-advances
// WAITING_FOR_PAYMENT → PAID (after MOCK_PAID_AFTER_MS) → COMPLETED (after
// MOCK_DONE_AFTER_MS). This approximates the W2.1/W2.2 jobs; the real backend
// owns this progression. `paidEligibleAt` is mock bookkeeping, stripped on read.
interface MockMintRecord extends MintOrderDetail {
  paidEligibleAt: number | null;
}
const mintOrders = new Map<string, MockMintRecord>();
const MOCK_PAID_AFTER_MS = 8_000;
const MOCK_DONE_AFTER_MS = 16_000;

export async function mockCreateMintOrder(req: CreateMintOrderRequest): Promise<MintOrderCreated> {
  await delay(600);
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
  mintOrders.set(id, {
    ...created,
    type: "MINT",
    inputCurrency: req.amountCurrency,
    mintFeePct: String(MOCK_MINT_FEE_PCT),
    paymentChannel: null,
    pgFeeIdr: null,
    totalFeeIdr: null,
    totalPayIdr: null,
    paymentBank: null,
    paymentProvider: "MOCK",
    virtualAccountNo: null,
    paymentUrl: null,
    paymentRef: null,
    paidAt: null,
    safeTxHash: null,
    onChainTxHash: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    paidEligibleAt: null,
  });
  return created;
}

export async function mockPayMintOrder(
  id: string,
  req: PayMintOrderRequest,
): Promise<MintOrderDetail> {
  await delay(500);
  const order = mintOrders.get(id);
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order tidak ditemukan");
  if (order.paymentStatus !== "REQUESTED") {
    throw new ApiError(409, "INVALID_ORDER_STATE", "Order tidak dalam status REQUESTED");
  }
  const subtotal = Number(order.subtotalIdr);
  const pgFee = req.channel === "VA" ? MOCK_PG_FEE_VA : subtotal * (MOCK_PG_FEE_QRIS_PCT / 100);
  const totalFee = Number(order.mintFeeIdr) + pgFee;
  order.paymentChannel = req.channel;
  order.paymentBank = req.channel === "VA" ? (req.bank ?? "BCA") : null;
  order.pgFeeIdr = idr(pgFee);
  order.totalFeeIdr = idr(totalFee);
  order.totalPayIdr = idr(Math.floor(subtotal + totalFee)); // ≥ Rp10.000 floor, round down
  order.virtualAccountNo = req.channel === "VA" ? "8808" + String(Date.now()).slice(-10) : null;
  order.paymentUrl = req.channel === "QRIS" ? "https://mock.pay.local/qris/" + id : null;
  order.paymentRef = "MOCKREF" + String(Date.now()).slice(-8);
  order.paymentStatus = "WAITING_FOR_PAYMENT";
  order.status = "WAITING_FOR_PAYMENT";
  order.expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  order.updatedAt = new Date().toISOString();
  order.paidEligibleAt = Date.now() + MOCK_PAID_AFTER_MS;
  return stripMockBookkeeping(order);
}

export async function mockGetMintOrder(id: string): Promise<MintOrderDetail> {
  await delay(200);
  const order = mintOrders.get(id);
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order tidak ditemukan");
  advanceMockMintLifecycle(order);
  return stripMockBookkeeping(order);
}

function advanceMockMintLifecycle(order: MockMintRecord): void {
  if (order.paidEligibleAt == null) return;
  const now = Date.now();
  if (order.paymentStatus === "WAITING_FOR_PAYMENT" && now >= order.paidEligibleAt) {
    order.paymentStatus = "PAID";
    order.paidAt = new Date().toISOString();
    order.safeStatus = "PENDING_APPROVAL";
    order.status = "WAITING_FOR_APPROVAL";
    order.updatedAt = order.paidAt;
  }
  if (
    order.paymentStatus === "PAID" &&
    order.status !== "COMPLETED" &&
    now >= order.paidEligibleAt - MOCK_PAID_AFTER_MS + MOCK_DONE_AFTER_MS
  ) {
    order.safeStatus = "EXECUTED";
    order.status = "COMPLETED";
    order.onChainTxHash = "0x" + now.toString(16).padStart(64, "0").slice(0, 64);
    order.safeTxHash = "0x" + (now + 1).toString(16).padStart(64, "0").slice(0, 64);
    order.updatedAt = new Date().toISOString();
  }
}

function stripMockBookkeeping(order: MockMintRecord): MintOrderDetail {
  const { paidEligibleAt: _paidEligibleAt, ...detail } = order;
  return detail;
}

function mintRecordToTransaction(order: MockMintRecord): ConsumerTransaction {
  return {
    id: order.id,
    type: "MINT",
    amount: order.amount,
    subtotalIdr: order.subtotalIdr,
    totalPayIdr: order.totalPayIdr,
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
      totalPayIdr: idr(Math.floor(subtotal * 1.017)),
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
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = params.type ? all.filter((t) => t.type === params.type) : all;
  const start = (page - 1) * take;
  return {
    data: filtered.slice(start, start + take),
    metadata: { page, limit: take, total: filtered.length },
  };
}
