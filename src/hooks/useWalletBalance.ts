"use client";

import { useQuery } from "@tanstack/react-query";
import { mockGetWalletBalance } from "@/lib/api/mock-api";

export function useWalletBalance(walletAddress: string | undefined) {
  return useQuery({
    queryKey: ["walletBalance", walletAddress],
    queryFn: mockGetWalletBalance,
    enabled: !!walletAddress,
  });
}
