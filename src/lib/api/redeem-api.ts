// Redeem API (consumer v2, Phase 2 Week 3 — USDX-243, hardened USDX-259). Routes
// to the real backend or the mock layer based on `env.useMock`.
//   POST /api/v2/redeem            → create order (AWAITING_BURN) + fee breakdown +
//                                    redeemId/contractAddress/amountWei + userAddress
//                                    echo (the FE sends the connected wallet, USDX-259)
//   GET  /api/v2/redeem/{id}        → order + live status (status-tracker polling;
//                                    used for resume from /history too)
//   POST /api/v2/redeem/{id}/burn-tx → report the burn tx hash optimistically after
//                                    broadcast (status stays AWAITING_BURN, USDX-259)
//
// The on-chain burn `redeem(redeemId, amountWei)` is signed from the user's own
// wallet (not an API call); the backend's Redeem Event Scanner advances the
// order. The real writeContract is wired in lib/redeem/burn.ts (USDX-263); the
// mock layer simulates it when env.useMock is on.
//
// Errors the caller handles (redeem.yaml, week3.md § Endpoints Redeem):
// - 403 EMAIL_NOT_VERIFIED / KYC_NOT_VERIFIED / ACCOUNT_SUSPENDED (gating)
// - 422 INVALID_BANK_ACCOUNT (inquiry) / INSUFFICIENT_BALANCE / WALLET_BLACKLISTED
//   (wallet pre-check) / VALIDATION_ERROR (incl. net < Rp 10.000 / bad txHash)
// - 409 INVALID_ORDER_STATE (burn-tx on a non-AWAITING_BURN/EXPIRED order)
// - 429 RATE_LIMITED · 503 REDEEM_DISABLED (no real disbursement provider)

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { RedeemOrderCreated, RedeemOrderDetail } from "@/types";
import type { CreateRedeemOrderRequest, ReportBurnTxRequest } from "./types";
import { mockCreateRedeemOrder, mockGetRedeemOrder, mockReportBurnTx } from "./mock-api";

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

// Optimistic burn-tx report (USDX-259). Fired right after the burn is broadcast
// so the tracker can show "memproses burn"; the scanner still owns the BURNED
// transition. Best-effort — a failure (e.g. 409 INVALID_ORDER_STATE) never blocks
// the flow since the scanner picks the event up independently.
export async function reportBurnTx(
  id: string,
  req: ReportBurnTxRequest,
): Promise<RedeemOrderDetail> {
  if (env.useMock) return mockReportBurnTx(id, req.txHash);
  return apiFetch<RedeemOrderDetail>(`/api/v2/redeem/${id}/burn-tx`, {
    method: "POST",
    body: req,
  });
}
