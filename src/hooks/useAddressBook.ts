"use client";

// User's saved mint destination wallets (USDX-201). GET /api/v2/address-book
// (address-book.yaml). The "To" field picker reads this list; the "Add Wallet"
// mutation lands in USDX-203.

import { useQuery } from "@tanstack/react-query";
import { listAddressBook } from "@/lib/api/address-book-api";

export const ADDRESS_BOOK_KEY = ["address-book"];

export function useAddressBook() {
  return useQuery({
    queryKey: ADDRESS_BOOK_KEY,
    queryFn: listAddressBook,
    staleTime: 30_000,
  });
}
