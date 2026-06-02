import type {
  LoginRequest,
  RegisterRequest,
  CreateMintRequest,
  CreateRedeemRequest,
} from "./types";
import type {
  AuthResponse,
  MintOrder,
  RedeemOrder,
  Transaction,
  TransactionType,
  TransactionStatus,
  BankAccount,
  User,
} from "@/types";

// Simulated delay
function delay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock user database
const MOCK_USERS: { email: string; password: string; user: User }[] = [
  {
    email: "demo@usdx.com",
    password: "Demo1234",
    user: {
      id: "usr_1",
      fullName: "Demo User",
      email: "demo@usdx.com",
      isVerified: true,
      createdAt: "2026-01-01T00:00:00Z",
    },
  },
];

export async function mockLogin(req: LoginRequest): Promise<AuthResponse> {
  await delay();
  const found = MOCK_USERS.find(
    (u) => u.email === req.email && u.password === req.password
  );
  if (!found) throw new Error("Invalid email or password");
  return { user: found.user, token: "mock-jwt-token-" + found.user.id };
}

export async function mockRegister(
  req: RegisterRequest
): Promise<AuthResponse> {
  await delay();
  if (MOCK_USERS.some((u) => u.email === req.email)) {
    throw new Error("Email already registered");
  }
  const newUser: User = {
    id: "usr_" + Date.now(),
    fullName: req.fullName,
    email: req.email,
    isVerified: false,
    createdAt: new Date().toISOString(),
  };
  MOCK_USERS.push({ email: req.email, password: req.password, user: newUser });
  return { user: newUser, token: "mock-jwt-token-" + newUser.id };
}

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
