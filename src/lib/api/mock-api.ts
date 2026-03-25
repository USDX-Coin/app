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
  return [
    {
      id: "tx_1",
      type: "mint",
      amount: 1000,
      chainId: "base",
      status: "completed",
      txHash: "0xabc123...def456",
      createdAt: "2026-03-20T10:30:00Z",
    },
    {
      id: "tx_2",
      type: "redeem",
      amount: 500,
      chainId: "polygon",
      status: "completed",
      txHash: "0x789abc...123def",
      createdAt: "2026-03-19T14:15:00Z",
    },
    {
      id: "tx_3",
      type: "mint",
      amount: 2500,
      chainId: "bsc",
      status: "pending",
      txHash: "0xdef789...abc123",
      createdAt: "2026-03-18T09:00:00Z",
    },
    {
      id: "tx_4",
      type: "redeem",
      amount: 100,
      chainId: "base",
      status: "failed",
      txHash: "0x456def...789abc",
      createdAt: "2026-03-17T16:45:00Z",
    },
    {
      id: "tx_5",
      type: "mint",
      amount: 5000,
      chainId: "polygon",
      status: "completed",
      txHash: "3xYz...AbCd",
      createdAt: "2026-03-16T11:20:00Z",
    },
    {
      id: "tx_6",
      type: "mint",
      amount: 750,
      chainId: "etherlink",
      status: "completed",
      txHash: "0xfed321...cba654",
      createdAt: "2026-03-15T08:00:00Z",
    },
    {
      id: "tx_7",
      type: "redeem",
      amount: 3000,
      chainId: "kaia",
      status: "completed",
      txHash: "0x111aaa...222bbb",
      createdAt: "2026-03-14T13:30:00Z",
    },
    {
      id: "tx_8",
      type: "mint",
      amount: 200,
      chainId: "lisk",
      status: "pending",
      txHash: "0x333ccc...444ddd",
      createdAt: "2026-03-13T07:15:00Z",
    },
    {
      id: "tx_9",
      type: "redeem",
      amount: 1500,
      chainId: "monad",
      status: "completed",
      txHash: "0x555eee...666fff",
      createdAt: "2026-03-12T19:00:00Z",
    },
    {
      id: "tx_10",
      type: "mint",
      amount: 10000,
      chainId: "base",
      status: "completed",
      txHash: "0x777ggg...888hhh",
      createdAt: "2026-03-11T12:00:00Z",
    },
  ];
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
