// Mint API (consumer v2, Phase 2 Week 2). App hanya pegang langkah CREATE:
//   POST /api/v2/mint → order REQUESTED, lalu app redirect ke checkout own-hosted
//   (`mint.usdx.co.id`, repo `checkout`). Pay (POST /{id}/pay) + status (GET /{id})
//   PINDAH ke repo `checkout` (USDX-224/225) — tidak lagi dipanggil dari app.
// Routes ke backend real atau mock layer berdasarkan `env.useMock`.
//
// Error yang di-handle pemanggil (review modal — week2.md § Endpoints Mint):
// - 403 EMAIL_NOT_VERIFIED / KYC_NOT_VERIFIED / ACCOUNT_SUSPENDED (gating)
// - 422 RECIPIENT_BLACKLISTED (destination can't receive USDX) / VALIDATION_ERROR
// - 503 MINT_DISABLED (no real payment provider in this env — `isMintDisabled`)

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { MintOrderCreated } from "@/types";
import type { CreateMintOrderRequest } from "./types";
import { mockCreateMintOrder } from "./mock-api";

export async function createMintOrder(
  req: CreateMintOrderRequest,
): Promise<MintOrderCreated> {
  if (env.useMock) return mockCreateMintOrder(req);
  return apiFetch<MintOrderCreated>("/api/v2/mint", { method: "POST", body: req });
}
