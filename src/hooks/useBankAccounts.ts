"use client";

// User's saved redeem payout bank accounts (USDX-261). bank-accounts.yaml.
// - useBankAccounts(): GET /api/v2/bank-accounts — the redeem bank-book picker reads this.
// - useAddBankAccount(): POST — the "Add Bank Account" modal (409 BANK_ACCOUNT_ALREADY_EXISTS
//   surfaces inline; the caller branches on it).
// - useDeleteBankAccount(): DELETE /{id} — per-entry delete from the picker.
// Both mutations invalidate the list so the picker refreshes after a change.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBankAccounts,
  addBankAccount,
  deleteBankAccount,
} from "@/lib/api/bank-accounts-api";
import type { CreateBankAccountRequest } from "@/lib/api/types";

export const BANK_ACCOUNTS_KEY = ["bank-accounts"];

export function useBankAccounts() {
  return useQuery({
    queryKey: BANK_ACCOUNTS_KEY,
    queryFn: listBankAccounts,
    staleTime: 30_000,
  });
}

export function useAddBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateBankAccountRequest) => addBankAccount(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_KEY });
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBankAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_KEY });
    },
  });
}
