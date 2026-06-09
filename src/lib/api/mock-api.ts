import type {
  LoginRequest,
  RegisterRequest,
  VerifyEmailRequest,
  ResetPasswordRequest,
  SubmitKycRequest,
  PresignedUploadRequest,
  PresignedUploadResult,
  CreateMintRequest,
  CreateRedeemRequest,
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
} from "@/types";
import { ApiError } from "./client";

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

export async function mockLogin(req: LoginRequest): Promise<AuthResponse> {
  await delay();
  const account = accounts.get(req.email);
  if (!account || account.password !== req.password) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
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

export async function mockRegister(req: RegisterRequest): Promise<RegisterResult> {
  await delay();
  if (accounts.has(req.email)) {
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email already registered");
  }
  const now = new Date().toISOString();
  const user: User = {
    id: "usr_" + Date.now(),
    name: null,
    email: req.email,
    phone: req.phone,
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

// Mock verify-email: marks the most recently registered unverified account
// verified and issues a session (auto-login), mirroring the real contract.
export async function mockVerifyEmail(_req: VerifyEmailRequest): Promise<AuthResponse> {
  await delay();
  const account =
    [...accounts.values()].reverse().find((a) => !a.user.emailVerifiedAt) ??
    accounts.get("demo@usdx.com")!;
  account.user.emailVerifiedAt = new Date().toISOString();
  currentEmail = account.user.email;
  return { user: account.user, token: tokenFor(account.user) };
}

export async function mockResendVerification(): Promise<void> {
  await delay(300);
}

export async function mockForgotPassword(): Promise<void> {
  await delay(300);
}

// Mock reset-password: verifies + auto-logs-in the most relevant account.
export async function mockResetPassword(_req: ResetPasswordRequest): Promise<AuthResponse> {
  await delay();
  const account = currentAccount() ?? accounts.get("demo@usdx.com")!;
  account.user.emailVerifiedAt = account.user.emailVerifiedAt ?? new Date().toISOString();
  currentEmail = account.user.email;
  return { user: account.user, token: tokenFor(account.user) };
}

export async function mockGetMe(): Promise<User> {
  await delay(200);
  return currentAccount()?.user ?? DEMO_USER;
}

// ── Mock KYC backend ─────────────────────────────────────────────────────
export async function mockGetMyKycStatus(): Promise<KycMyStatus> {
  await delay(200);
  const user = currentAccount()?.user ?? DEMO_USER;
  if (user.kycStatus === "UNVERIFIED") {
    return { status: "UNVERIFIED", submissionCount: null, submittedAt: null, reviewedAt: null, rejectionReason: null };
  }
  return {
    status: user.kycStatus,
    submissionCount: 1,
    submittedAt: user.updatedAt,
    reviewedAt: user.kycStatus === "PENDING" ? null : user.updatedAt,
    rejectionReason: user.kycStatus === "REJECTED" ? "Foto KTP buram, mohon submit ulang." : null,
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
