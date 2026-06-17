// Transactions / History API (consumer, Phase 2 Week 2 — USDX-205). Routes to
// the real backend (GET /api/v2/transactions) or the mock layer based on
// `env.useMock`. Mint-only in W2; the endpoint is union-ready (param `type`,
// REDEEM effective W3). Returns the paginated envelope (page/limit/total) so the
// history page (USDX-204) can paginate. (transactions.yaml § list)

import { env } from "@/lib/env";
import { apiFetchPaginated, type Paginated } from "./client";
import type { ConsumerTransaction } from "@/types";
import type { ListTransactionsParams } from "./types";
import { mockListConsumerTransactions } from "./mock-api";

export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<Paginated<ConsumerTransaction>> {
  if (env.useMock) return mockListConsumerTransactions(params);
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.take) query.set("take", String(params.take));
  if (params.type) query.set("type", params.type);
  const qs = query.toString();
  return apiFetchPaginated<ConsumerTransaction>(
    `/api/v2/transactions${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}
