// Redeem API (consumer v2, Phase 2 Week 3 — USDX-243). Routes to the real
// backend or the mock layer based on `env.useMock`.
//   POST /api/v2/redeem        → create order (AWAITING_BURN) + fee breakdown +
//                                redeemId/contractAddress/amountWei for the burn tx
//   GET  /api/v2/redeem/{id}    → order + live status (status-tracker polling)
//
// The on-chain burn `redeem(redeemId, amountWei)` is signed from the user's own
// wallet (not an API call); the backend's Redeem Event Scanner advances the
// order. In W3 the burn is simulated (see lib/redeem/burn.ts) — the real
// writeContract + real API land in INT-1 (USDX-249).
//
// Errors the caller handles (redeem.yaml, week3.md § Endpoints Redeem):
// - 403 EMAIL_NOT_VERIFIED / KYC_NOT_VERIFIED / ACCOUNT_SUSPENDED (gating)
// - 422 INVALID_BANK_ACCOUNT (inquiry failed) / VALIDATION_ERROR (incl. net < Rp 10.000)
// - 429 RATE_LIMITED · 503 REDEEM_DISABLED (no real disbursement provider)

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { RedeemOrderCreated, RedeemOrderDetail } from "@/types";
import type { CreateRedeemOrderRequest } from "./types";
import { mockCreateRedeemOrder, mockGetRedeemOrder } from "./mock-api";

export async function createRedeemOrder(
  req: CreateRedeemOrderRequest,
): Promise<RedeemOrderCreated> {
  if (env.useMock) return mockCreateRedeemOrder(req);
  return apiFetch<RedeemOrderCreated>("/api/v2/redeem", { method: "POST", body: req });
}

export async function getRedeemOrder(id: string): Promise<RedeemOrderDetail> {
  if (env.useMock) return mockGetRedeemOrder(id);
  return apiFetch<RedeemOrderDetail>(`/api/v2/redeem/${id}`, { method: "GET" });
}
