// Mint API (consumer v2, Phase 2 Week 2 — USDX-205). 2-step flow:
//   create (POST /api/v2/mint) → pay (POST /api/v2/mint/{id}/pay) → poll
//   (GET /api/v2/mint/{id}). Routes to the real backend or the mock layer based
// on `env.useMock` (mint.yaml § mintV2*). The mint form + checkout UIs that
// drive this land in USDX-201/202.
//
// Errors callers branch on (handled inline by the mint pages):
// - 403 EMAIL_NOT_VERIFIED / KYC_NOT_VERIFIED / ACCOUNT_SUSPENDED (gating)
// - 422 RECIPIENT_BLACKLISTED (destination can't receive USDX) / VALIDATION_ERROR
// - 503 MINT_DISABLED (no real payment provider in this env — `isMintDisabled`)
// - 409 INVALID_ORDER_STATE (re-/pay on a non-REQUESTED order)

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { MintOrderCreated, MintOrderDetail } from "@/types";
import type { CreateMintOrderRequest, PayMintOrderRequest } from "./types";
import { mockCreateMintOrder, mockPayMintOrder, mockGetMintOrder } from "./mock-api";

export async function createMintOrder(
  req: CreateMintOrderRequest,
): Promise<MintOrderCreated> {
  if (env.useMock) return mockCreateMintOrder(req);
  return apiFetch<MintOrderCreated>("/api/v2/mint", { method: "POST", body: req });
}

export async function payMintOrder(
  id: string,
  req: PayMintOrderRequest,
): Promise<MintOrderDetail> {
  if (env.useMock) return mockPayMintOrder(id, req);
  return apiFetch<MintOrderDetail>(`/api/v2/mint/${id}/pay`, { method: "POST", body: req });
}

export async function getMintOrder(id: string): Promise<MintOrderDetail> {
  if (env.useMock) return mockGetMintOrder(id);
  return apiFetch<MintOrderDetail>(`/api/v2/mint/${id}`, { method: "GET" });
}
