"use client";

// Consumer transaction history (USDX-204). GET /api/v2/transactions
// (transactions.yaml § list) via the real-or-mock client. Week 2 is mint-only;
// the endpoint is union-ready (param `type`, REDEEM effective W3). Pagination +
// type filter are server-side, so the page passes them in and reads `metadata`
// (page/limit/total) off the paginated envelope. `keepPreviousData` keeps the
// table populated while the next page/filter loads (no flash to skeleton).

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/transactions-api";
import type { ListTransactionsParams } from "@/lib/api/types";

export const TRANSACTIONS_KEY = ["transactions"];

export function useTransactions(params: ListTransactionsParams = {}) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, params],
    queryFn: () => listTransactions(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
