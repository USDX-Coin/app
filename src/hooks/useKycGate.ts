"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyKycStatus } from "@/lib/api/kyc-api";
import { KYC_STATUS_KEY } from "@/hooks/useKyc";
import { useSessionUser } from "@/hooks/useSession";
import type { KycStatus } from "@/types";

// Action gate for Week 2+ transactions (USDX-153). Pages stay fully explorable;
// the gate intercepts the primary action (mint/redeem — bridge/send are
// ComingSoon-gated and have no primary action) and opens a
// per-status dialog instead of the flow until kyc_status = VERIFIED. Status comes
// from GET /v2/kyc/me (same cache entry as the /kyc page), falling back to the
// session user from GET /v2/auth/me. Suspended / unverified-email users never get
// this far — login already blocks them (403).
export function useKycGate() {
  const { user } = useSessionUser();
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
  // customer who is verified. Unknown is its own state: block nothing, show nothing.
  const loading = !statusQuery.data && !user;

  const status: KycStatus =
    statusQuery.data?.status ?? user?.kycStatus ?? "UNVERIFIED";
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
    rejectionReason: statusQuery.data?.rejectionReason ?? null,
    open,
    setOpen,
    guard,
  };
}
