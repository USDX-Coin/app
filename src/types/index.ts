export interface User {
  id: string;
  fullName: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
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
export type TransactionType = "mint" | "redeem";

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

export interface AuthResponse {
  user: User;
  token: string;
}

export type MintStep = "form" | "review" | "payment";
export type RedeemStep = "form" | "review" | "executing" | "success";
