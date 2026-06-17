// Rate API (consumer, Phase 2 Week 2 — USDX-205). Routes to the real backend
// (GET /api/v2/rate) or the mock layer based on `env.useMock`. Used by the mint
// form to preview the IDR conversion via `effectiveBuyRate` (rate.yaml § rateV2).

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { ConsumerRate } from "@/types";
import { mockGetConsumerRate } from "./mock-api";

export async function getConsumerRate(): Promise<ConsumerRate> {
  if (env.useMock) return mockGetConsumerRate();
  return apiFetch<ConsumerRate>("/api/v2/rate", { method: "GET" });
}
