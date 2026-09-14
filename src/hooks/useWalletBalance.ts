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
//
// USDX-640: the token address comes from GET /api/v2/config instead of the build
// (the address baked into a bundle has been shipped stale before). The config
// carries the two tokens in two separate fields, so nothing has to be inferred:
// `contractAddress` is always the production token, and `testContractAddress` is
// non-null only while the test-mint bundle is switched on. The MAIN balance
// reads the production one in every mode — swapping it globally would show a
// real USDX holder a balance of 0 — and the test token gets its own strip.

import { useUsdxBalance } from "@/lib/redeem/wallet";
import { useAppConfig } from "@/hooks/useAppConfig";
import { EXCHANGE_RATE } from "@/lib/constants";
import { resolveBalanceTokens } from "@/lib/balance-tokens";

// Di-ekspor ulang: pemanggil lama (dan test-nya) menyasar modul ini.
export { resolveBalanceTokens } from "@/lib/balance-tokens";
export type { BalanceTokens } from "@/lib/balance-tokens";

export type WalletBalanceState = "disconnected" | "loading" | "unavailable" | "ready";

/** The test-mint strip: a second balance, clearly not the user's USDX. */
export interface TestTokenBalance {
  state: WalletBalanceState;
  balanceUsdx: number | null;
  address: `0x${string}`;
}

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
  /**
   * Test-mint balance, or null when there is nothing extra to show — which is
   * every PROD-mode session, i.e. the normal case.
   */
  testBalance: TestTokenBalance | null;
}


function stateOf(read: {
  isConnected: boolean;
  isBalanceLoading: boolean;
  balanceUsdx: number | null;
}): WalletBalanceState {
  if (!read.isConnected) return "disconnected";
  if (read.isBalanceLoading) return "loading";
  return read.balanceUsdx == null ? "unavailable" : "ready";
}

export function useWalletBalance(): WalletBalance {
  const config = useAppConfig();
  const tokens = resolveBalanceTokens(
    config.contractAddress,
    config.testContractAddress,
    config.mintMode,
  );

  const read = useUsdxBalance(tokens.main);
  // Called unconditionally (rules of hooks). `null` means the read is off, so a
  // PROD-mode session does not pay for a second RPC call.
  const testRead = useUsdxBalance(tokens.test, "test");

  const state = stateOf(read);
  const balanceUsdx = state === "ready" ? read.balanceUsdx : null;

  const testState = stateOf(testRead);

  return {
    state,
    balanceUsdx,
    balanceUsd: balanceUsdx == null ? null : balanceUsdx * EXCHANGE_RATE,
    isConnected: read.isConnected,
    address: read.address,
    connect: read.connect,
    testBalance:
      tokens.test == null
        ? null
        : {
            state: testState,
            balanceUsdx: testState === "ready" ? testRead.balanceUsdx : null,
            address: tokens.test,
          },
  };
}
