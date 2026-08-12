"use client";

// User's saved mint destination wallets (USDX-201/203). address-book.yaml.
// - useAddressBook(): GET /api/v2/address-book — the "To" field picker reads this.
// - useAddAddressBook(): POST — the "Add Wallet" modal (409 ADDRESS_ALREADY_EXISTS
//   surfaces inline; the caller branches on it).
// - useDeleteAddressBook(): DELETE /{id} — per-entry delete from the picker.
// Both mutations invalidate the list so the picker refreshes after a change.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAddressBook,
  addAddressBookEntry,
  deleteAddressBookEntry,
} from "@/lib/api/address-book-api";
import type { CreateAddressBookRequest } from "@/lib/api/types";

export const ADDRESS_BOOK_KEY = ["address-book"];

export function useAddressBook() {
  return useQuery({
    queryKey: ADDRESS_BOOK_KEY,
    queryFn: listAddressBook,
    staleTime: 30_000,
  });
}

export function useAddAddressBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateAddressBookRequest) => addAddressBookEntry(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESS_BOOK_KEY });
    },
  });
}

export function useDeleteAddressBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAddressBookEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESS_BOOK_KEY });
    },
  });
}
