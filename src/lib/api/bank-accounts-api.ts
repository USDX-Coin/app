// Bank Account Book API (consumer, Phase 2 Week 3 — USDX-261). Per-user saved
// redeem payout bank accounts. Routes to the real backend (/api/v2/bank-accounts)
// or the mock layer based on `env.useMock` (bank-accounts.yaml). Parity with the
// address-book client; the account is PII (ciphertext at-rest), but the owner sees
// their own data — GET returns the full number + bankName (un-mask 2026-06-25).
//
// Errors surfaced for callers to branch on:
// - POST duplicate (bankCode + accountNumber) → 409 BANK_ACCOUNT_ALREADY_EXISTS
// - POST invalid input → 422 VALIDATION_ERROR
// - DELETE someone else's entry → 404 NOT_FOUND

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { BankAccountEntry } from "@/types";
import type { CreateBankAccountRequest } from "./types";
import {
  mockListBankAccounts,
  mockAddBankAccount,
  mockDeleteBankAccount,
} from "./mock-api";

export async function listBankAccounts(): Promise<BankAccountEntry[]> {
  if (env.useMock) return mockListBankAccounts();
  return apiFetch<BankAccountEntry[]>("/api/v2/bank-accounts", { method: "GET" });
}

export async function addBankAccount(
  req: CreateBankAccountRequest,
): Promise<BankAccountEntry> {
  if (env.useMock) return mockAddBankAccount(req);
  return apiFetch<BankAccountEntry>("/api/v2/bank-accounts", { method: "POST", body: req });
}

export async function deleteBankAccount(id: string): Promise<{ id: string }> {
  if (env.useMock) return mockDeleteBankAccount(id);
  return apiFetch<{ id: string }>(`/api/v2/bank-accounts/${id}`, { method: "DELETE" });
}
