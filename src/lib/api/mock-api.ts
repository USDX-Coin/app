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
  CreateBankAccountRequest,
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
  BankAccountEntry,
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

// ── Mock W3 consumer: Bank Account Book (USDX-261) ──────────────────────────
// In-memory saved redeem payout accounts (per page load). Parity address book,
// but the account is PII: the plaintext number is kept only to dedup (mirrors the
// backend blind index) and is NEVER returned — the entry exposes a masked number.
// Seeded so the redeem bank-book picker isn't empty in dev; seeds share the map so
// the dup-check (409) and delete cover them too.
interface MockBankAccountRecord {
  entry: BankAccountEntry;
  accountNumber: string; // plaintext, dedup only; never returned
}

function makeBankAccountRecord(
  id: string,
  bankCode: string,
  accountNumber: string,
  accountName: string,
  label: string | null,
  createdAt: string,
): [string, MockBankAccountRecord] {
  return [
    id,
    {
      entry: {
        id,
        bankCode,
        accountNumberMasked: maskAccount(accountNumber),
        accountName,
        label,
        createdAt,
      },
      accountNumber,
    },
  ];
}

const bankAccounts = new Map<string, MockBankAccountRecord>([
  makeBankAccountRecord("seed_bank_1", "014", "1234563210", "SINGGIH BRILIAN TARA", "BCA utama", "2026-06-12T08:00:00.000Z"),
  makeBankAccountRecord("seed_bank_2", "008", "7788990011", "SINGGIH BRILIAN TARA", null, "2026-06-11T08:00:00.000Z"),
]);

export async function mockListBankAccounts(): Promise<BankAccountEntry[]> {
  await delay(150);
  return [...bankAccounts.values()]
    .map((r) => r.entry)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function mockAddBankAccount(req: CreateBankAccountRequest): Promise<BankAccountEntry> {
  await delay(200);
  // v2 DTO validation → 422 VALIDATION_ERROR (mirrors the backend pipe; runs before
  // the 409 dup business check). account number 6–20 digits, name ≥ 2 chars, label ≤ 50.
  const accountNumber = req.accountNumber.trim();
  const accountName = req.accountName.trim();
  const label = req.label?.trim() ?? "";
  if (
    req.bankCode.trim() === "" ||
    !/^[0-9]{6,20}$/.test(accountNumber) ||
    accountName.length < 2 ||
    label.length > 50
  ) {
    throw new ApiError(422, "VALIDATION_ERROR", "Data rekening tidak valid");
  }
  // Dedup per user via bank_code + account_number (mock stand-in for the blind index).
  const duplicate = [...bankAccounts.values()].some(
    (r) => r.entry.bankCode === req.bankCode && r.accountNumber === accountNumber,
  );
  if (duplicate) {
    throw new ApiError(409, "BANK_ACCOUNT_ALREADY_EXISTS", "Rekening sudah ada di daftar rekening Anda");
  }
  const id = "bank_" + Date.now();
  const entry: BankAccountEntry = {
    id,
    bankCode: req.bankCode,
    accountNumberMasked: maskAccount(accountNumber),
    accountName,
    label: label === "" ? null : label,
    createdAt: new Date().toISOString(),
  };
  bankAccounts.set(id, { entry, accountNumber });
  return entry;
}

export async function mockDeleteBankAccount(id: string): Promise<{ id: string }> {
  await delay(150);
  if (!bankAccounts.has(id)) throw new ApiError(404, "NOT_FOUND", "Rekening tidak ditemukan");
  bankAccounts.delete(id);
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
// Lifecycle timings, all measured from burnSubmittedAtMs (the optimistic report):
//   0 .. CONFIRM      → AWAITING_BURN + burnSubmittedAt set ("memproses burn",
//                       finality gate REDEEM_CONFIRMATIONS not yet reached)
//   CONFIRM .. PAYOUT → BURNED then PROCESSING_PAYOUT (Disbursement Trigger)
//   ≥ PAYOUT          → PAYOUT_COMPLETE
const MOCK_BURN_CONFIRM_MS = 2_500; // finality sim: "memproses burn" → BURNED
const MOCK_BURNED_VISIBLE_MS = 5_000; // BURNED visible before payout starts
const MOCK_PAYOUT_COMPLETE_MS = 8_500; // PROCESSING_PAYOUT → PAYOUT_COMPLETE
// week3.md REDEEM_LATE_BURN_GRACE default (24h): a burn past expires_at within the
// grace still auto-pays (late_burn); beyond it → stale_burn, payout held.
const MOCK_REDEEM_LATE_BURN_GRACE_MS = 24 * 60 * 60_000;
// Test seam: a redeem to this account number fails inquiry → 422
// INVALID_BANK_ACCOUNT (week3.md § Validasi rekening), so the FE inline-error
// path is exercisable offline. Any other number passes (mock inquiry always valid).
export const MOCK_INVALID_BANK_ACCOUNT = "0000000000";
// Wallet pre-check seam (week3.md § Week 3 Addendum, USDX-259): a create with this
// userAddress fails the on-chain blacklist pre-check → 422 WALLET_BLACKLISTED.
// Reuses the mint blacklist sentinel so a single address drives both flows.
const MOCK_BLACKLISTED_WALLET = MOCK_BLACKLISTED_ADDRESS;
// Mirror of the client balance precondition seam (lib/redeem/wallet.ts): when the
// armed mock USDX balance is below the redeemed amount, create returns 422
// INSUFFICIENT_BALANCE (the backend backstop to the client-side gate). Unarmed →
// skipped (best-effort, like the real RPC pre-check).
const MOCK_WALLET_BALANCE_KEY = "usdx-mock-wallet-balance";

function mockWalletBalanceUsdx(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(MOCK_WALLET_BALANCE_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

interface MockRedeemRecord {
  order: RedeemOrderCreated; // create-time snapshot (immutable money/bank fields)
  inputCurrency: AmountCurrency;
  bankAccountNumber: string; // plaintext kept only to derive payoutRef determinism; never returned
  createdAtMs: number;
  expiresAtMs: number;
  // Anchor for the whole post-burn lifecycle: stamped when the burn is broadcast /
  // reported (optimistic). BURNED → payout are then derived from elapsed time
  // (mirrors the finality gate + Disbursement Trigger auto-complete). Null until
  // the user burns — the create-but-not-burned state the resume flow reopens.
  burnSubmittedAtMs: number | null;
  burnTxHash: string | null;
  userAddress: string; // bound at create from the request userAddress (USDX-259)
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

// A seeded AWAITING_BURN order, resumable from /history (USDX-259). Lets the
// resume flow — reconnect wallet, wallet-bound guard — be exercised without first
// creating an order. Bound to the default mock wallet so a matching reconnect can
// burn it; a different connected wallet triggers the "terikat ke wallet lain"
// warning. Re-seeded on every full page load (module eval) with a fresh 30-min
// window, so it stays AWAITING_BURN.
export const SEED_RESUME_REDEEM_ID = "rdm_seed_resume";
export const SEED_RESUME_USER_ADDRESS = "0xC0FFEE0000000000000000000000000000C0FFEE";

function seedResumableRedeemOrder() {
  const rate = mockEffectiveSellRate();
  const amountUsdx = 100;
  const b = computeRedeemBreakdown({
    amount: amountUsdx,
    amountCurrency: "USD",
    effectiveSellRate: rate,
    redeemFeePct: REDEEM_FEE_PCT,
    disbursementFeeFlatIdr: DISBURSEMENT_FEE_FLAT_IDR,
  });
  const createdAtMs = Date.now() - 60_000; // a minute ago
  const expiresAtMs = createdAtMs + MOCK_REDEEM_BURN_TTL_MS;
  const order: RedeemOrderCreated = {
    id: SEED_RESUME_REDEEM_ID,
    orderNumber: "RDMSEEDRESUME",
    customerName: "Demo User",
    chain: "polygon",
    userAddress: SEED_RESUME_USER_ADDRESS,
    contractAddress: MOCK_USDX_CONTRACT,
    redeemId: "0x" + "ab".repeat(32),
    amount: String(amountUsdx),
    amountWei: toUsdxWei(amountUsdx),
    baseRate: idr(MOCK_BASE_RATE),
    spreadSellPct: String(MOCK_SPREAD_SELL_PCT),
    effectiveRate: idr(rate),
    grossIdr: idr(b.grossIdr),
    redeemFeePct: String(REDEEM_FEE_PCT),
    redeemFeeIdr: idr(b.redeemFeeIdr),
    disbursementFeeIdr: idr(b.disbursementFeeIdr),
    totalFeeIdr: idr(b.totalFeeIdr),
    netPayoutIdr: idr(b.netPayoutIdr),
    bankCode: "014",
    bankAccountNumberMasked: maskAccount("1234563210"),
    bankAccountName: "Demo User",
    status: "AWAITING_BURN",
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
  redeemOrders.set(SEED_RESUME_REDEEM_ID, {
    order,
    inputCurrency: "USD",
    bankAccountNumber: "1234563210",
    createdAtMs,
    expiresAtMs,
    burnSubmittedAtMs: null,
    burnTxHash: null,
    userAddress: SEED_RESUME_USER_ADDRESS,
  });
}
seedResumableRedeemOrder();

export async function mockCreateRedeemOrder(
  req: CreateRedeemOrderRequest,
): Promise<RedeemOrderCreated> {
  await delay(600);
  maybeThrowRateLimited(); // 429 RATE_LIMITED seam (USDX-252)
  const rate = mockEffectiveSellRate();
  const b = computeRedeemBreakdown({
    amount: Number(req.amount),
    amountCurrency: req.amountCurrency,
    effectiveSellRate: rate,
    redeemFeePct: REDEEM_FEE_PCT,
    disbursementFeeFlatIdr: DISBURSEMENT_FEE_FLAT_IDR,
  });
  // Reject precedence (week3.md § backend actions): wallet pre-check → inquiry
  // rekening → min-payout. The amount is resolved first (above) because the
  // pre-check needs amountUsdx, but that step is side-effect free.
  //
  // Wallet pre-check (week3.md § Week 3 Addendum, USDX-259, best-effort): blacklist
  // then balance. The FE precondition gate normally blocks these before create;
  // this is the backend backstop.
  if (req.userAddress.toLowerCase() === MOCK_BLACKLISTED_WALLET) {
    throw new ApiError(422, "WALLET_BLACKLISTED", "Wallet ini tidak dapat melakukan burn");
  }
  const balanceUsdx = mockWalletBalanceUsdx();
  if (balanceUsdx !== null && balanceUsdx < b.amountUsdx) {
    throw new ApiError(422, "INSUFFICIENT_BALANCE", "Saldo USDX tidak cukup");
  }
  // Account inquiry (week3.md § Validasi rekening) runs before burn — invalid
  // rekening rejected up front so no USDX is burned without a valid payout target.
  if (req.bankAccountNumber === MOCK_INVALID_BANK_ACCOUNT) {
    throw new ApiError(422, "INVALID_BANK_ACCOUNT", "Rekening tujuan tidak valid atau tidak ditemukan");
  }
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
    userAddress: req.userAddress, // bound at create (echo) — USDX-259
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
    burnSubmittedAtMs: null,
    burnTxHash: null,
    userAddress: req.userAddress,
  });
  return order;
}

// Stands in for: user signs `redeem(redeemId, amountWei)` from their wallet →
// broadcast. Returns the tx hash; the lifecycle only starts advancing once the
// hash is reported (mockReportBurnTx) — mirroring the real flow where the FE
// broadcasts, reports optimistically, and the scanner confirms. `fromAddress` is
// the connected wallet (real, even in mock mode); it must match the bound
// userAddress or the scanner would reject the burn (the FE guards this on resume).
// Test seam (USDX-259): arm `usdx-mock-burn-reject` so the next broadcast throws
// a wallet-rejection error (then auto-disarms → a retry succeeds). Lets the FE
// guard-double-burn + retry path be exercised offline. Mock-only, one-shot.
const BURN_REJECT_KEY = "usdx-mock-burn-reject";

function maybeRejectBurn(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(BURN_REJECT_KEY) == null) return;
  localStorage.removeItem(BURN_REJECT_KEY); // one-shot → the retry goes through
  throw new Error("USER_REJECTED: transaction rejected in wallet");
}

export async function mockBroadcastRedeemBurn(
  redeemId: string,
  fromAddress: string,
): Promise<{ burnTxHash: string }> {
  await delay(400);
  maybeRejectBurn(); // wallet-rejection seam (before any state change)
  const record = [...redeemOrders.values()].find((r) => r.order.redeemId === redeemId);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Redeem order tidak ditemukan");
  void fromAddress; // bound at create; the burn signs from it (no-op in the sim)
  // Idempotent: keep the first broadcast's hash (week3.md § Scanner idempotent —
  // a second burn with the same id loses USDX, so the FE must guard double-burn).
  if (!record.burnTxHash) record.burnTxHash = "0x" + randomHex(32);
  return { burnTxHash: record.burnTxHash };
}

// POST /api/v2/redeem/{id}/burn-tx (USDX-259): the FE reports the burn tx hash
// optimistically after broadcast. Stamps burnSubmittedAtMs + burnTxHash; status
// stays AWAITING_BURN (the derived lifecycle then advances to BURNED after the
// confirmation window). Idempotent per order; 409 if not AWAITING_BURN/EXPIRED.
export async function mockReportBurnTx(id: string, txHash: string): Promise<RedeemOrderDetail> {
  await delay(200);
  maybeThrowRateLimited();
  const record = redeemOrders.get(id);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Redeem order tidak ditemukan");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Hash transaksi tidak valid");
  }
  const status = resolveRedeemDetail(record).status;
  // Only AWAITING_BURN / EXPIRED (late burn) may report — beyond that the scanner
  // already owns the order (week3.md § burn-tx endpoint).
  if (status !== "AWAITING_BURN" && status !== "EXPIRED") {
    throw new ApiError(409, "INVALID_ORDER_STATE", "Order tidak dalam status menunggu burn");
  }
  // Idempotent: first report wins the timestamp; a later hash overwrites the hash
  // (scanner stays the arbiter) without resetting the confirmation clock.
  if (record.burnSubmittedAtMs == null) record.burnSubmittedAtMs = Date.now();
  record.burnTxHash = txHash;
  return resolveRedeemDetail(record);
}

// Derives the live status + payout fields from elapsed time since the burn was
// reported, mirroring the W3 job lifecycle (finality gate → BURNED →
// PROCESSING_PAYOUT → PAYOUT_COMPLETE) and the late-burn / stale-burn cutoffs.
function resolveRedeemDetail(record: MockRedeemRecord): RedeemOrderDetail {
  const { order, burnSubmittedAtMs, expiresAtMs } = record;
  const now = Date.now();

  let status: RedeemStatus;
  let payoutRef: string | null = null;
  let payoutCompletedAt: string | null = null;
  let burnedAt: string | null = null;

  // Burn happened after expires_at + grace → held for manual reconcile (FX risk;
  // week3.md § Late-burn cutoff). It still reaches BURNED but never auto-pays.
  const staleBurn =
    burnSubmittedAtMs != null && burnSubmittedAtMs > expiresAtMs + MOCK_REDEEM_LATE_BURN_GRACE_MS;
  // Late burn: reported after the order had already EXPIRED (within grace) — still pays.
  const lateBurn = burnSubmittedAtMs != null && burnSubmittedAtMs > expiresAtMs;

  if (burnSubmittedAtMs == null) {
    status = now > expiresAtMs ? "EXPIRED" : "AWAITING_BURN";
  } else {
    const elapsed = now - burnSubmittedAtMs;
    if (elapsed < MOCK_BURN_CONFIRM_MS) {
      // Optimistic window: tx broadcast/reported but not yet confirmed on-chain.
      status = "AWAITING_BURN";
    } else {
      burnedAt = new Date(burnSubmittedAtMs + MOCK_BURN_CONFIRM_MS).toISOString();
      if (staleBurn) {
        // BURNED but payout held — no PROCESSING_PAYOUT/PAYOUT_COMPLETE.
        status = "BURNED";
      } else if (elapsed < MOCK_BURNED_VISIBLE_MS) {
        status = "BURNED";
      } else if (elapsed < MOCK_PAYOUT_COMPLETE_MS) {
        status = "PROCESSING_PAYOUT";
        payoutRef = "MOCK-" + order.orderNumber;
      } else {
        status = "PAYOUT_COMPLETE";
        payoutRef = "MOCK-" + order.orderNumber;
        payoutCompletedAt = new Date(burnSubmittedAtMs + MOCK_PAYOUT_COMPLETE_MS).toISOString();
      }
    }
  }

  return {
    ...order,
    status,
    type: "REDEEM",
    userAddress: record.userAddress,
    inputCurrency: record.inputCurrency,
    lateBurn,
    staleBurn,
    payoutProvider: "MOCK",
    payoutRef,
    burnTxHash: record.burnTxHash,
    burnSubmittedAt: burnSubmittedAtMs != null ? new Date(burnSubmittedAtMs).toISOString() : null,
    burnedAt,
    payoutCompletedAt,
    createdAt: new Date(record.createdAtMs).toISOString(),
    updatedAt: new Date(now).toISOString(),
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
  // No AWAITING_BURN seed here — the only resumable AWAITING_BURN row comes from
  // the in-map seed (seedResumableRedeemOrder), so every "Continue" affordance in
  // /history points at an order the tracker can actually GET (USDX-259).
  const seeds: { usdx: number; status: RedeemStatus; burned: boolean }[] = [
    { usdx: 100, status: "PAYOUT_COMPLETE", burned: true },
    { usdx: 250, status: "PROCESSING_PAYOUT", burned: true },
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
