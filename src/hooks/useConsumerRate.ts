"use client";

// Live USD/IDR rate for the consumer mint preview (USDX-201). GET /api/v2/rate
// (rate.yaml § rateV2). The form uses `effectiveBuyRate` for conversion; the
// final transaction value is re-snapshotted by the backend at order create.

import { useQuery } from "@tanstack/react-query";
import { getConsumerRate } from "@/lib/api/rate-api";

export const CONSUMER_RATE_KEY = ["consumer-rate"];

export function useConsumerRate() {
  return useQuery({
    queryKey: CONSUMER_RATE_KEY,
    queryFn: getConsumerRate,
    staleTime: 30_000,
    retry: 1,
  });
}
