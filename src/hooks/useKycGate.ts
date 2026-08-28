"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyKycStatus } from "@/lib/api/kyc-api";
import { KYC_STATUS_KEY } from "@/hooks/useKyc";
import { useSessionUser } from "@/hooks/useSession";
import { isUnreachable } from "@/lib/api/errors";
import type { KycStatus } from "@/types";

// Action gate for Week 2+ transactions (USDX-153). Pages stay fully explorable;
// the gate intercepts the primary action (mint/redeem — bridge/send are
// ComingSoon-gated and have no primary action) and opens a
// per-status dialog instead of the flow until kyc_status = VERIFIED. Status comes
// from GET /v2/kyc/me (same cache entry as the /kyc page), falling back to the
// session user from GET /v2/auth/me. Suspended / unverified-email users never get
// this far — login already blocks them (403).
export function useKycGate() {
  const session = useSessionUser();
  const [open, setOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: KYC_STATUS_KEY,
    queryFn: getMyKycStatus,
    staleTime: 30_000,
    retry: false,
  });

  // Neither source has answered yet. The old `?? "UNVERIFIED"` default was safe
  // only because the user object came back instantly from localStorage; now it does
  // not, and defaulting would open a "complete your KYC" dialog in the face of a
  // customer who IS verified. Unknown is its own state: the CTA waits (disabled),
  // no dialog, no verdict.
  const loading = !statusQuery.data && !session.user;

  // …and when BOTH sources have failed with something other than a 401, that wait is
  // never going to end on its own. The CTA still stays disabled — with the backend
  // unreachable the transaction could not go through anyway — but a button that dies
  // in silence is the worst thing to hand a customer: they cannot tell whether the
  // app is broken, their account is, or they are, so they call us or leave. Callers
  // put a one-line reason next to the disabled button. Not a dialog, not a retry:
  // this is not a verdict about the customer, just the state of the connection.
  const unavailable = loading && session.unreachable && isUnreachable(statusQuery.error);

  const status: KycStatus =
    statusQuery.data?.status ?? session.user?.kycStatus ?? "UNVERIFIED";
  const verified = !loading && status === "VERIFIED";

  const guard = useCallback(
    (action: () => void) => {
      if (loading) return; // wait — callers keep the CTA disabled meanwhile
      if (verified) {
        action();
      } else {
        setOpen(true);
      }
    },
    [loading, verified],
  );

  return {
    status,
    verified,
    loading,
    unavailable,
    rejectionReason: statusQuery.data?.rejectionReason ?? null,
    open,
    setOpen,
    guard,
  };
}
