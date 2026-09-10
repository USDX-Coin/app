"use client";

// Runtime config for the consumer app (USDX-635). GET /api/v2/config
// (app-config.yaml) — the mint minimum in rupiah, the fee rates shown before
// checkout, the token address the balance is read from, and the mint bundle in
// force. Same shape and caching as `useConsumerRate`.
//
// The numbers arrive as decimal strings and are parsed ONCE here, at the edge.
// They are `null` — never a guessed default — until the response lands: a made-up
// minimum silently blocks a valid amount, and a made-up fee is a wrong number on
// a payment screen. Callers gate on `isReady` and disable the action instead
// (mint.configUnavailable).

import { useQuery } from "@tanstack/react-query";
import { getAppConfig } from "@/lib/api/config-api";
import type { AppConfig } from "@/types";

export const APP_CONFIG_KEY = ["app-config"];

// A decimal string from the API → a finite number, or null. Guards the case that
// matters: a field the backend sends as null/"" must not become 0, because 0 is a
// perfectly plausible minimum and a perfectly plausible fee.
function toNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface AppConfigRead {
  config: AppConfig | null;
  /** Minimum mint value in IDR (`minMintIdr`), compared against the subtotal. */
  minMintIdr: number | null;
  /** Mint fee as a percentage of the subtotal (`mintFeePct`, "1.0" → 1). */
  mintFeePct: number | null;
  /** Flat VA fee in IDR (`pgFeeVaFlat`). */
  pgFeeVaFlat: number | null;
  /** USDX token address for `chain`, or null when the backend has none. */
  contractAddress: string | null;
  /**
   * Which mint bundle is in force. Absent in the response → "PROD": the field
   * only exists from USDX-636 onwards, and an unknown mode must never read as
   * a test one.
   */
  mintMode: "PROD" | "TEST";
  /** The three numbers the mint screen needs are all present. */
  isReady: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
}

export function useAppConfig(): AppConfigRead {
  const query = useQuery({
    queryKey: APP_CONFIG_KEY,
    queryFn: getAppConfig,
    staleTime: 30_000,
    retry: 1,
  });

  const config = query.data ?? null;
  const minMintIdr = toNumber(config?.minMintIdr);
  const mintFeePct = toNumber(config?.mintFeePct);
  const pgFeeVaFlat = toNumber(config?.pgFeeVaFlat);

  return {
    config,
    minMintIdr,
    mintFeePct,
    pgFeeVaFlat,
    contractAddress: config?.contractAddress ?? null,
    mintMode: config?.mintMode === "TEST" ? "TEST" : "PROD",
    isReady: minMintIdr != null && mintFeePct != null && pgFeeVaFlat != null,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}
