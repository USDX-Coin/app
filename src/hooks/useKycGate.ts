"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyKycStatus } from "@/lib/api/kyc-api";
import { KYC_STATUS_KEY } from "@/hooks/useKyc";
import { useAuthStore } from "@/stores/authStore";
import type { KycStatus } from "@/types";

// Action gate for Week 2+ transactions (USDX-153). Pages stay fully explorable;
// the gate intercepts the primary action (mint/redeem — bridge/send are
// ComingSoon-gated and have no primary action) and opens a
// per-status dialog instead of the flow until kyc_status = VERIFIED. Status comes
// from GET /v2/kyc/me (same cache entry as the /kyc page), with the persisted
// user as fallback while the query is in flight. Suspended / unverified-email
// users never get this far — login already blocks them (403).
export function useKycGate() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: KYC_STATUS_KEY,
    queryFn: getMyKycStatus,
    staleTime: 30_000,
    retry: false,
  });

  const status: KycStatus =
    statusQuery.data?.status ?? user?.kycStatus ?? "UNVERIFIED";
  const verified = status === "VERIFIED";

  const guard = useCallback(
    (action: () => void) => {
      if (verified) {
        action();
      } else {
        setOpen(true);
      }
    },
    [verified],
  );

  return {
    status,
    verified,
    rejectionReason: statusQuery.data?.rejectionReason ?? null,
    open,
    setOpen,
    guard,
  };
}
