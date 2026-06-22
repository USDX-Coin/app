"use client";

// Status-tracker polling for a created redeem order (USDX-243). Polls
// GET /api/v2/redeem/{id} every 2s and stops once the order reaches a terminal
// state (PAYOUT_COMPLETE / EXPIRED). The lifecycle AWAITING_BURN → BURNED →
// PROCESSING_PAYOUT → PAYOUT_COMPLETE is driven by the backend (mock in W3).

import { useQuery } from "@tanstack/react-query";
import { getRedeemOrder } from "@/lib/api/redeem-api";
import type { RedeemStatus } from "@/types";

const TERMINAL_STATUSES: RedeemStatus[] = ["PAYOUT_COMPLETE", "EXPIRED"];

export function useRedeemTracker(orderId: string | null) {
  return useQuery({
    queryKey: ["redeem-order", orderId],
    queryFn: () => getRedeemOrder(orderId as string),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_STATUSES.includes(status) ? false : 2_000;
    },
  });
}
