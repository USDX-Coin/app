"use client";

// Shared on-chain burn runner (USDX-259). Used by both the fresh-create flow
// (useRedeem, after POST /v2/redeem) and the resume flow (RedeemStatus, for an
// AWAITING_BURN order reopened from /history). Encapsulates the guard
// double-burn state machine (week3.md § Guard double-burn):
//   sign + broadcast → optimistic POST /v2/redeem/{id}/burn-tx → scanner confirms.
// Once broadcast the order's burn button stays disabled (burnState submitting →
// submitted); a rejected/failed tx flips to `error` so the user can retry (the
// order stays AWAITING_BURN). The burn itself is simulated in W3 (lib/redeem/burn);
// the real writeContract lands in INT-1 (USDX-249).

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { signAndBroadcastBurn } from "@/lib/redeem/burn";
import { reportBurnTx } from "@/lib/api/redeem-api";
import { isInvalidOrderState } from "@/lib/api/errors";
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
  const burnState = useRedeemStore((s) => s.burnState);
  const burnErrorKey = useRedeemStore((s) => s.burnErrorKey);
  const setBurnState = useRedeemStore((s) => s.setBurnState);
  const setBurnError = useRedeemStore((s) => s.setBurnError);

  const runBurn = useCallback(
    async (order: RedeemOrderCreated, fromAddress: string) => {
      // Guard double-burn: never start a second burn while one is in flight.
      const current = useRedeemStore.getState().burnState;
      if (current === "submitting" || current === "submitted") return;

      setBurnError(null);
      setBurnState("submitting");
      try {
        const { burnTxHash } = await signAndBroadcastBurn(order, fromAddress);
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
    [queryClient, setBurnState, setBurnError],
  );

  return { runBurn, burnState, burnErrorKey };
}
