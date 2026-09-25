// Transactions / History API (consumer — USDX-205, riwayat terpadu USDX-713). Routes to
// the real backend (GET /api/v2/transactions) or the mock layer based on
// `env.useMock`. Union mint + redeem, plus custodial transfers in/out when asked
// (`type=TRANSFER_IN|TRANSFER_OUT`, or `includeTransfers=true` for "Semua" —
// custodial-wallet.md §5.7). Returns the paginated envelope (page/limit/total) so
// the history page can paginate; rows of a type the app does not know yet are
// dropped here (`knownHistoryItems`). (transactions.yaml § list)

import { env } from "@/lib/env";
import { knownHistoryItems } from "@/lib/history-item";
import { apiFetchPaginated, type Paginated } from "./client";
import type { HistoryItem } from "@/types";
import type { ListTransactionsParams } from "./types";
import { mockListConsumerTransactions } from "./mock-api";

export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<Paginated<HistoryItem>> {
  const page = env.useMock ? await mockListConsumerTransactions(params) : await fetchPage(params);
  return { ...page, data: knownHistoryItems(page.data) };
}

function fetchPage(params: ListTransactionsParams): Promise<Paginated<unknown>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.take) query.set("take", String(params.take));
  // `type` diisi → server mengabaikan includeTransfers; jangan kirim keduanya.
  if (params.type) query.set("type", params.type);
  else if (params.includeTransfers) query.set("includeTransfers", "true");
  const qs = query.toString();
  return apiFetchPaginated<unknown>(`/api/v2/transactions${qs ? `?${qs}` : ""}`, { method: "GET" });
}
