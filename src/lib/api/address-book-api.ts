// Address Book API (consumer, Phase 2 Week 2 — USDX-205). Per-user saved mint
// destination wallets. Routes to the real backend (/api/v2/address-book) or the
// mock layer based on `env.useMock` (address-book.yaml).
//
// Errors surfaced for callers to branch on (the rich UI lands in USDX-203):
// - POST duplicate address → 409 ADDRESS_ALREADY_EXISTS
// - DELETE someone else's entry → 404 NOT_FOUND

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { AddressBookEntry } from "@/types";
import type { CreateAddressBookRequest } from "./types";
import {
  mockListAddressBook,
  mockAddAddressBook,
  mockDeleteAddressBook,
} from "./mock-api";

export async function listAddressBook(): Promise<AddressBookEntry[]> {
  if (env.useMock) return mockListAddressBook();
  return apiFetch<AddressBookEntry[]>("/api/v2/address-book", { method: "GET" });
}

export async function addAddressBookEntry(
  req: CreateAddressBookRequest,
): Promise<AddressBookEntry> {
  if (env.useMock) return mockAddAddressBook(req);
  return apiFetch<AddressBookEntry>("/api/v2/address-book", { method: "POST", body: req });
}

export async function deleteAddressBookEntry(id: string): Promise<{ id: string }> {
  if (env.useMock) return mockDeleteAddressBook(id);
  return apiFetch<{ id: string }>(`/api/v2/address-book/${id}`, { method: "DELETE" });
}
