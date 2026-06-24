"use client";

// Shared on-chain burn runner (USDX-259). Used by both the fresh-create flow
// (useRedeem, after POST /v2/redeem) and the resume flow (RedeemStatus, for an
// AWAITING_BURN order reopened from /history). Encapsulates the guard
// double-burn state machine (week3.md § Guard double-burn):
//   sign + broadcast → optimistic POST /v2/redeem/{id}/burn-tx → scanner confirms.
// Once broadcast the order's burn button stays disabled (burnState submitting →
// submitted); a rejected/failed tx flips to `error` so the user can retry (the
// order stays AWAITING_BURN). The real on-chain `redeem()` write is signed via
// wagmi's `writeContractAsync` here and injected into signAndBroadcastBurn
// (USDX-263); when `env.useMock` is on the burn is simulated (lib/redeem/burn).

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import { useRedeemStore } from "@/stores/redeemStore";
import { signAndBroadcastBurn, REDEEM_ABI, type BurnExecutor } from "@/lib/redeem/burn";
import { reportBurnTx } from "@/lib/api/redeem-api";
import { isInvalidOrderState } from "@/lib/api/errors";
import { REDEEM_CHAIN_NUM_ID } from "@/lib/constants";
import type { RedeemOrderCreated } from "@/types";

// Wallet rejection (user denied the signature) vs any other failure — both keep
// the order AWAITING_BURN and offer a retry, but the copy differs.
function mapBurnError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/reject|denied|USER_REJECTED/i.test(message)) return "redeem.burnRejected";
  return "redeem.burnFailed";
}

export function useRedeemBurn() {
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const burnState = useRedeemStore((s) => s.burnState);
  const burnErrorKey = useRedeemStore((s) => s.burnErrorKey);
  const setBurnState = useRedeemStore((s) => s.setBurnState);
  const setBurnError = useRedeemStore((s) => s.setBurnError);

  const runBurn = useCallback(
    async (order: RedeemOrderCreated, fromAddress: string) => {
      // Guard double-burn: never start a second burn while one is in flight.
      const current = useRedeemStore.getState().burnState;
      if (current === "submitting" || current === "submitted") return;

      // Wagmi-bound executor for the real on-chain write (USDX-263). Ignored on
      // the mock path (env.useMock) where the burn is simulated.
      const executor: BurnExecutor = ({ contractAddress, redeemId, amountWei, account }) =>
        writeContractAsync({
          address: contractAddress,
          abi: REDEEM_ABI,
          functionName: "redeem",
          args: [redeemId, amountWei],
          account,
          chainId: REDEEM_CHAIN_NUM_ID,
        });

      setBurnError(null);
      setBurnState("submitting");
      try {
        const { burnTxHash } = await signAndBroadcastBurn(order, fromAddress, executor);
        // Broadcast succeeded — lock the button ("memproses burn") and report the
        // hash optimistically. The report is best-effort: a 409 INVALID_ORDER_STATE
        // (scanner already advanced) or any other failure never blocks the flow,
        // since the scanner picks the event up independently.
        setBurnState("submitted");
        try {
          await reportBurnTx(order.id, { txHash: burnTxHash });
        } catch (reportError) {
          if (!isInvalidOrderState(reportError)) {
            // swallow — the scanner remains the source of truth for BURNED
          }
        }
        queryClient.invalidateQueries({ queryKey: ["redeem-order", order.id] });
      } catch (error) {
        // Tx rejected/failed in the wallet → re-enable retry (order stays AWAITING_BURN).
        setBurnState("error");
        setBurnError(mapBurnError(error));
      }
    },
    [queryClient, setBurnState, setBurnError, writeContractAsync],
  );

  return { runBurn, burnState, burnErrorKey };
}
