// Sign + broadcast the redeem burn `redeem(redeemId, amountWei)` (USDX-243).
//
// W3 simulates this end-to-end: the wallet *connection* is real, but the
// on-chain tx is faked via the mock layer (which also stands in for the backend
// Redeem Event Scanner that flips the order to BURNED). The real path — build +
// sign the tx with viem/wagmi from the user's wallet, broadcast, and let the
// real scanner advance the order — lands in INT-1 (USDX-249).

import { env } from "@/lib/env";
import { mockBroadcastRedeemBurn } from "@/lib/api/mock-api";
import type { RedeemOrderCreated } from "@/types";

export async function signAndBroadcastBurn(
  order: RedeemOrderCreated,
  fromAddress: string,
): Promise<{ burnTxHash: string }> {
  if (env.useMock) {
    return mockBroadcastRedeemBurn(order.redeemId, fromAddress);
  }
  // INT-1: writeContract(redeem, [order.redeemId, BigInt(order.amountWei)]) on
  // the connected wallet, then poll GET /v2/redeem/{id} as the scanner detects it.
  throw new Error("On-chain burn is not available in this build (lands in INT-1).");
}
