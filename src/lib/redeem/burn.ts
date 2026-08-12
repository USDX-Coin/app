// Sign + broadcast the redeem burn `redeem(redeemId, amountWei)` (USDX-243,
// real on-chain wiring USDX-263).
//
// The order's `contractAddress` is the USDX proxy on Polygon; `redeem(bytes32 id,
// uint256 amount)` is a public self-burn that emits `Redeem(user, amount, id)` —
// the backend Redeem Event Scanner watches for it and advances the order to
// BURNED. We resolve as soon as the tx is broadcast (returning the hash), NOT
// after a receipt: the FE reports the hash optimistically and the scanner stays
// the source of truth for BURNED (week3.md § burn-tx endpoint, USDX-259).
//
// The wagmi write is injected as `executor` (built from `useWriteContract` in
// useRedeemBurn) so this module stays free of React/wagmi and remains
// unit-testable. When `env.useMock` is on, the burn is simulated via the mock
// layer (which also stands in for the scanner) so the whole flow runs offline.

import { env } from "@/lib/env";
import { mockBroadcastRedeemBurn } from "@/lib/api/mock-api";
import type { RedeemOrderCreated } from "@/types";

// Minimal ABI for the public self-burn. `id` is a bytes32 event tag — NOT an
// idempotency lock, it is reusable (smart-contract.md § redeem); the FE guards
// against a double-burn instead. Reverts `SenderBlacklisted` for a blacklisted
// wallet (the create-time pre-check is best-effort; the contract is the backstop).
export const REDEEM_ABI = [
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// Signs + broadcasts the burn and resolves with the tx hash. Injected from
// useRedeemBurn (wagmi `writeContractAsync`) to keep this module React-free.
export type BurnExecutor = (params: {
  contractAddress: `0x${string}`;
  redeemId: `0x${string}`;
  amountWei: bigint;
  account: `0x${string}`;
}) => Promise<`0x${string}`>;

export async function signAndBroadcastBurn(
  order: RedeemOrderCreated,
  fromAddress: string,
  executor: BurnExecutor,
): Promise<{ burnTxHash: string }> {
  if (env.useMock) {
    return mockBroadcastRedeemBurn(order.redeemId, fromAddress);
  }
  // Real on-chain: write `redeem(redeemId, amountWei)` to the USDX proxy from the
  // connected wallet. Resolves with the broadcast tx hash (not a receipt).
  const burnTxHash = await executor({
    contractAddress: order.contractAddress as `0x${string}`,
    redeemId: order.redeemId as `0x${string}`,
    amountWei: BigInt(order.amountWei),
    account: fromAddress as `0x${string}`,
  });
  return { burnTxHash };
}
