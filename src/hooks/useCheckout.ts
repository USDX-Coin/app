"use client";

// Checkout logic (USDX-202): polls GET /v2/mint/{id} for the order + status
// tracker, runs the POST /v2/mint/{id}/pay mutation, and derives the payment
// countdown. Polling stops once the order is terminal (COMPLETED/FAILED) or the
// countdown expires (the BE Expiry job W2.3 isn't live yet, so the FE treats a
// past `expiresAt` as expired client-side).

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMintOrder, payMintOrder } from "@/lib/api/mint-api";
import { isApiError, isValidationError } from "@/lib/api/errors";
import type { PaymentChannel, VaBank } from "@/types";

const POLL_MS = 3000;
const TERMINAL = new Set(["COMPLETED", "FAILED"]);

function payErrorKey(error: unknown): string | null {
  if (!error) return null;
  if (isApiError(error)) {
    if (error.code === "INVALID_ORDER_STATE") return "checkout.errOrderState";
    if (isValidationError(error)) return "checkout.errValidation";
    if (error.code === "MINT_DISABLED") return "mint.errDisabled";
  }
  return "checkout.errPayGeneric";
}

export function useCheckout(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["mint-order", id],
    queryFn: () => getMintOrder(id),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: (q) => {
      const o = q.state.data;
      if (!o || TERMINAL.has(o.status)) return false;
      if (new Date(o.expiresAt).getTime() <= Date.now()) return false; // expired → stop
      // Poll while we're waiting for payment confirmation / on-chain settlement.
      return o.paymentStatus === "WAITING_FOR_PAYMENT" || o.status === "WAITING_FOR_APPROVAL"
        ? POLL_MS
        : false;
    },
  });

  const order = query.data ?? null;

  // 1s tick drives the countdown display.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isTerminal = order ? TERMINAL.has(order.status) : false;
  const secondsLeft = order
    ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000))
    : 0;
  const isExpired = Boolean(order) && !isTerminal && secondsLeft <= 0;

  const payMutation = useMutation({
    mutationFn: (vars: { channel: PaymentChannel; bank?: VaBank | null }) =>
      payMintOrder(id, vars),
    onSuccess: (updated) => {
      queryClient.setQueryData(["mint-order", id], updated);
    },
  });

  return {
    order,
    isLoading: query.isLoading,
    isError: query.isError,
    pay: (channel: PaymentChannel, bank?: VaBank | null) =>
      payMutation.mutateAsync({ channel, bank }),
    isPaying: payMutation.isPending,
    payErrorKey: payErrorKey(payMutation.error),
    secondsLeft,
    isExpired,
    isTerminal,
  };
}
