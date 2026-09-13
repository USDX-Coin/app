// App config (consumer v2 — USDX-635). ONE endpoint for everything the app used
// to hardcode: the mint minimum (in rupiah), the fee rates it shows before
// checkout, and the token address the balance is read from.
//
//   GET /api/v2/config → { minMintIdr, mintFeePct, pgFeeVaFlat, contractAddress,
//                          chain, mintMode? }
//
// Needs a consumer session — 401 without one, so callers must be inside the
// dashboard shell. Routes to the mock layer when `env.useMock` (app-config.yaml).

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { AppConfig } from "@/types";
import { mockGetAppConfig } from "./mock-api";

export async function getAppConfig(): Promise<AppConfig> {
  if (env.useMock) return mockGetAppConfig();
  return apiFetch<AppConfig>("/api/v2/config", { method: "GET" });
}
