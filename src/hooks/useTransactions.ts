"use client";

import { useQuery } from "@tanstack/react-query";
import { mockGetTransactions } from "@/lib/api/mock-api";

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: mockGetTransactions,
  });
}
