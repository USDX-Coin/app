"use client";

// The app's single balance surface API (USDX-396). Wraps the shared on-chain
// `balanceOf` read (lib/redeem/wallet.ts) into the four states a money UI has to
// tell apart, so no screen can accidentally print a number it does not have:
//
//   disconnected → no wallet connected yet → offer `connect()`, print no number
//   loading      → read in flight          → print a placeholder
//   unavailable  → read failed, or on-chain reads are off in this environment
//   ready        → `balanceUsdx` is a real, current on-chain number
//
// `balanceUsdx`/`balanceUsd` are non-null ONLY in the `ready` state. Zero is a
// legitimate `ready` value and is shown as 0 — "unknown" is never rendered as 0.

import { useUsdxBalance } from "@/lib/redeem/wallet";
import { EXCHANGE_RATE } from "@/lib/constants";

export type WalletBalanceState = "disconnected" | "loading" | "unavailable" | "ready";

export interface WalletBalance {
  state: WalletBalanceState;
  /** On-chain USDX balance. Non-null only when `state === "ready"`. */
  balanceUsdx: number | null;
  /** USD equivalent at the 1:1 peg. Non-null only when `state === "ready"`. */
  balanceUsd: number | null;
  isConnected: boolean;
  address: string | undefined;
  /** Opens the wallet connect flow (RainbowKit). */
  connect: () => void;
}

export function useWalletBalance(): WalletBalance {
  const read = useUsdxBalance();

  const state: WalletBalanceState = !read.isConnected
    ? "disconnected"
    : read.isBalanceLoading
      ? "loading"
      : read.balanceUsdx == null
        ? "unavailable"
        : "ready";

  const balanceUsdx = state === "ready" ? read.balanceUsdx : null;

  return {
    state,
    balanceUsdx,
    balanceUsd: balanceUsdx == null ? null : balanceUsdx * EXCHANGE_RATE,
    isConnected: read.isConnected,
    address: read.address,
    connect: read.connect,
  };
}
