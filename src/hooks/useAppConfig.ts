"use client";

// Runtime config for the consumer app (USDX-635). GET /api/v2/config
// (app-config.yaml) — the mint and redeem minimums in rupiah, the fee rates shown
// before checkout, the token address the balance is read from, and the mint bundle
// in force. Same shape and caching as `useConsumerRate`.
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
  /**
   * Minimum redeem value in IDR (`minRedeemIdr`, USDX-682), compared against the
   * NET payout. `null` while the field is absent — the backend ships it after the
   * app does — and `null` means the redeem screen asserts NO minimum of its own
   * and leaves the judgement to `POST /api/v2/redeem`. Deliberately not folded
   * into `isReady`: redeem does not need the config to show honest numbers (its
   * fee rates are its own), so a missing field must not close the screen.
   */
  minRedeemIdr: number | null;
  /** Mint fee as a percentage of the subtotal (`mintFeePct`, "1.0" → 1). */
  mintFeePct: number | null;
  /** Flat VA fee in IDR (`pgFeeVaFlat`). */
  pgFeeVaFlat: number | null;
  /** Production USDX token address for `chain`, or null when the backend has none. */
  contractAddress: string | null;
  /** Test-mint token address — non-null only in TEST mode, absent before USDX-636. */
  testContractAddress: string | null;
  /**
   * Whether this user may mint right now. Absent from the response → `true`:
   * the field only exists from USDX-636 onwards, and a missing gate must never
   * read as a closed one.
   */
  mintAvailable: boolean;
  /**
   * Which mint bundle is in force. Absent in the response → "PROD": the field
   * only exists from USDX-636 onwards, and an unknown mode must never read as
   * a test one.
   */
  mintMode: "PROD" | "TEST";
  /**
   * The three numbers the MINT screen needs are all present. `minRedeemIdr` is
   * not among them on purpose (USDX-682): it does not exist backend-side yet, and
   * gating this flag on it would switch the mint screen off.
   */
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
  const minRedeemIdr = toNumber(config?.minRedeemIdr);
  const mintFeePct = toNumber(config?.mintFeePct);
  const pgFeeVaFlat = toNumber(config?.pgFeeVaFlat);

  return {
    config,
    minMintIdr,
    minRedeemIdr,
    mintFeePct,
    pgFeeVaFlat,
    contractAddress: config?.contractAddress ?? null,
    testContractAddress: config?.testContractAddress ?? null,
    mintAvailable: config?.mintAvailable !== false,
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
