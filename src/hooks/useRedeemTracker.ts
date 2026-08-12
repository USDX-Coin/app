"use client";

// Status-tracker polling for a created redeem order (USDX-243). Polls
// GET /api/v2/redeem/{id} every 2s and stops once the order reaches a terminal
// state (PAYOUT_COMPLETE / EXPIRED). The lifecycle AWAITING_BURN → BURNED →
// PROCESSING_PAYOUT → PAYOUT_COMPLETE is driven by the backend (mock in W3).
//
// On a 429 RATE_LIMITED (throughput throttle, conventions.md § Rate Limiting) the
// poll backs off to Retry-After (≥1s) instead of hammering at the fixed interval;
// the global query retry (Providers) already skips retrying 429, and the throttle
// toast is shown centrally.

import { useQuery } from "@tanstack/react-query";
import { getRedeemOrder } from "@/lib/api/redeem-api";
import { isRateLimited, getRateLimitSeconds } from "@/lib/api/errors";
import type { RedeemStatus } from "@/types";

const TERMINAL_STATUSES: RedeemStatus[] = ["PAYOUT_COMPLETE", "EXPIRED"];
const POLL_MS = 2_000; // well under the 5 req/s throttle

export function useRedeemTracker(orderId: string | null) {
  return useQuery({
    queryKey: ["redeem-order", orderId],
    queryFn: () => getRedeemOrder(orderId as string),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      const error = query.state.error;
      if (isRateLimited(error)) return Math.max(1, getRateLimitSeconds(error) ?? 1) * 1_000;
      return POLL_MS;
    },
  });
}
