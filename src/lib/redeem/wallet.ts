"use client";

// Contextual wallet connect + precondition gate for redeem (USDX-243, hardened
// USDX-259). Redeem is the flow that *requires* a wallet (the user burns USDX from
// their own wallet) — there is no global connect button (W2 principle). This wraps
// wagmi/RainbowKit so the redeem form can ask "connected?" and open the connect
// modal in-flow, and adds the burn preconditions (week3.md § Week 3 Addendum):
//   1. network = Polygon (137) — prompt switch if not
//   2. USDX balance ≥ amount — read on-chain (balanceOf)
//   3. native POL gas warning (non-blocking)
//
// The connection + reads are REAL even when the API layer is mocked. The burn is
// real on-chain too when env.useMock is off (lib/redeem/burn.ts, USDX-263); the
// mock layer simulates it offline.
//
// USDX-396: the on-chain `balanceOf` read is also the app's ONE source of truth for
// "how much USDX does this user hold" — the sidebar balance card, Send and Bridge
// all read it through `useUsdxBalance` (surfaced to components as
// `hooks/useWalletBalance`). There is no backend balance endpoint in the SoT: the
// backend itself pre-checks redeem via RPC `balanceOf` (sot/api/redeem.yaml,
// week3.md § Pre-check saat create), so the chain is authoritative for both sides.
// `balanceUsdx` is `number | null` and NEVER falls back to a number — an unknown
// balance must stay unknown all the way to the screen.

import { useCallback } from "react";
import { create } from "zustand";
import { erc20Abi, formatUnits } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { env } from "@/lib/env";
import {
  REDEEM_CHAIN_NUM_ID,
  REDEEM_MIN_GAS_POL,
  USDX_CONTRACT_ADDRESS,
  USDX_DECIMALS,
} from "@/lib/constants";

// E2E seam (mock-only): Playwright has no wallet extension, so when this
// localStorage key is armed connect() flips to a deterministic mock wallet
// instead of opening RainbowKit — letting the full redeem flow run offline.
// Mirrors the KYC_OVERRIDE_KEY / retry-after seams in the mock layer. Real users
// (and dev with a real wallet) always go through RainbowKit.
//   usdx-mock-wallet         armed → use the mock wallet. A 0x… value is used as
//                            the address (lets resume tests bind a different
//                            wallet than the order); any other value → default.
//   usdx-mock-wallet-chain   numeric chain id (default 137) — arm a non-Polygon id
//                            to exercise the switch-network prompt.
//   usdx-mock-wallet-balance USDX balance (default plentiful) — arm below the
//                            amount to exercise the insufficient-balance gate.
//   usdx-mock-wallet-gas     native POL balance (default sufficient) — arm at 0 to
//                            exercise the low-gas warning.
const MOCK_WALLET_SEAM_KEY = "usdx-mock-wallet";
const MOCK_WALLET_CHAIN_KEY = "usdx-mock-wallet-chain";
const MOCK_WALLET_BALANCE_KEY = "usdx-mock-wallet-balance";
const MOCK_WALLET_GAS_KEY = "usdx-mock-wallet-gas";
const MOCK_WALLET_ADDRESS_DEFAULT = "0xC0FFEE0000000000000000000000000000C0FFEE";
// Seam-only defaults. These are the ONLY balance numbers left in the app, and they
// are double-gated: `env.useMock` AND a deliberately armed localStorage key
// (`seamArmed()`), i.e. reachable only from the offline Playwright harness. They
// are NOT a UI fallback — outside the seam an unknown balance stays null (USDX-396).
const MOCK_WALLET_BALANCE_DEFAULT_USDX = 1_000_000;
const MOCK_WALLET_GAS_DEFAULT_POL = 1;

function seamArmed(): boolean {
  return (
    env.useMock &&
    typeof localStorage !== "undefined" &&
    localStorage.getItem(MOCK_WALLET_SEAM_KEY) != null
  );
}

function readSeams() {
  const wallet = localStorage.getItem(MOCK_WALLET_SEAM_KEY);
  const address = wallet && wallet.startsWith("0x") ? wallet : MOCK_WALLET_ADDRESS_DEFAULT;
  const chainRaw = Number(localStorage.getItem(MOCK_WALLET_CHAIN_KEY));
  const chainId = Number.isFinite(chainRaw) && chainRaw > 0 ? chainRaw : REDEEM_CHAIN_NUM_ID;
  const balRaw = localStorage.getItem(MOCK_WALLET_BALANCE_KEY);
  const balanceUsdx =
    balRaw != null && Number.isFinite(Number(balRaw))
      ? Number(balRaw)
      : MOCK_WALLET_BALANCE_DEFAULT_USDX;
  const gasRaw = localStorage.getItem(MOCK_WALLET_GAS_KEY);
  const gasPol =
    gasRaw != null && Number.isFinite(Number(gasRaw))
      ? Number(gasRaw)
      : MOCK_WALLET_GAS_DEFAULT_POL;
  return { connected: true, address, chainId, balanceUsdx, gasPol };
}

// Shared across hook instances (form, Ringkasan modal, tracker) so they all see
// the same mock connection — wagmi's real `useAccount` is already global; this
// gives the seam the same shared semantics without a wallet extension.
interface MockWalletState {
  connected: boolean;
  address: string;
  chainId: number;
  balanceUsdx: number;
  gasPol: number;
  connect: () => void;
  switchChain: () => void;
}
const useMockWalletStore = create<MockWalletState>((set) => ({
  connected: false,
  address: MOCK_WALLET_ADDRESS_DEFAULT,
  chainId: REDEEM_CHAIN_NUM_ID,
  balanceUsdx: MOCK_WALLET_BALANCE_DEFAULT_USDX,
  gasPol: MOCK_WALLET_GAS_DEFAULT_POL,
  connect: () => set(readSeams()),
  switchChain: () => set({ chainId: REDEEM_CHAIN_NUM_ID }),
}));

export interface RedeemWallet {
  isConnected: boolean;
  address: string | undefined;
  connect: () => void;
}

// Connection-only view (kept for callers that don't need the precondition gate).
export function useRedeemWallet(): RedeemWallet {
  const account = useAccount();
  const { openConnectModal } = useConnectModal();
  const mockConnected = useMockWalletStore((s) => s.connected);
  const mockAddress = useMockWalletStore((s) => s.address);
  const mockConnect = useMockWalletStore((s) => s.connect);

  const connect = useCallback(() => {
    if (seamArmed()) mockConnect();
    else openConnectModal?.();
  }, [mockConnect, openConnectModal]);

  if (seamArmed()) {
    return { isConnected: mockConnected, address: mockConnected ? mockAddress : undefined, connect };
  }
  return { isConnected: account.isConnected, address: account.address, connect };
}

export interface UsdxBalanceRead {
  isConnected: boolean;
  address: string | undefined;
  connect: () => void;
  // USDX held by the connected wallet on Polygon, read on-chain (`balanceOf`).
  // null = UNKNOWN: not connected, still reading, the read failed, or on-chain
  // reads are off in this environment. Never a fallback number — callers must
  // render "unknown" as unknown (USDX-396).
  balanceUsdx: number | null;
  // The read is in flight for a connected wallet (→ show a loading state).
  isBalanceLoading: boolean;
  // Connected, not loading, still no number (read failed or unavailable here).
  isBalanceUnavailable: boolean;
}

// Single on-chain USDX balance read, shared by every balance surface in the app
// (USDX-396). All wagmi hooks are called unconditionally (rules of hooks); the
// mock seam overrides the result offline.
export function useUsdxBalance(): UsdxBalanceRead {
  const account = useAccount();
  const { openConnectModal } = useConnectModal();
  const mock = useMockWalletStore();

  const realAddress = account.address;
  const balanceRead = useReadContract({
    address: USDX_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: realAddress ? [realAddress] : undefined,
    chainId: REDEEM_CHAIN_NUM_ID,
    query: { enabled: !env.useMock && !!realAddress },
  });

  const connect = useCallback(() => {
    if (seamArmed()) mock.connect();
    else openConnectModal?.();
  }, [mock, openConnectModal]);

  // ── Mock seam path (E2E offline) ──────────────────────────────────────────
  if (seamArmed()) {
    return {
      isConnected: mock.connected,
      address: mock.connected ? mock.address : undefined,
      connect,
      balanceUsdx: mock.connected ? mock.balanceUsdx : null,
      isBalanceLoading: false,
      isBalanceUnavailable: false,
    };
  }

  // ── Real wagmi path ───────────────────────────────────────────────────────
  const isConnected = account.isConnected;
  const balanceUsdx =
    balanceRead.data != null ? Number(formatUnits(balanceRead.data, USDX_DECIMALS)) : null;
  // `isLoading` (not `isPending`) so a query that is disabled — mock mode, no
  // address — reads as "unavailable", not as an eternal spinner.
  const isBalanceLoading = isConnected && balanceRead.isLoading;
  return {
    isConnected,
    address: realAddress,
    connect,
    balanceUsdx,
    isBalanceLoading,
    isBalanceUnavailable: isConnected && !isBalanceLoading && balanceUsdx == null,
  };
}

export interface RedeemPreconditions {
  isConnected: boolean;
  address: string | undefined;
  connect: () => void;
  // network
  chainOk: boolean;
  switchNetwork: () => void;
  isSwitchingNetwork: boolean;
  // balance (USDX on Polygon, read on-chain). null = unknown/loading → optimistic.
  balanceUsdx: number | null;
  insufficientBalance: boolean;
  // gas (native POL) — non-blocking warning when likely too low to pay the tx fee.
  lowGasWarning: boolean;
  // overall: safe to enable "Konfirmasi & Burn" (gas is intentionally excluded —
  // it's a warning, not a block).
  canBurn: boolean;
}

// Full precondition gate for a given burn amount (USDX). All wagmi hooks are
// called unconditionally (rules of hooks); the seam overrides the result offline.
export function useRedeemPreconditions(amountUsdx: number): RedeemPreconditions {
  const account = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();

  const mock = useMockWalletStore();

  // Connection + USDX balance come from the shared on-chain read (USDX-396) so
  // redeem and every other balance surface can never disagree.
  const { isConnected, address, connect, balanceUsdx } = useUsdxBalance();

  const realAddress = account.address;
  const gasRead = useBalance({
    address: realAddress,
    chainId: REDEEM_CHAIN_NUM_ID,
    query: { enabled: !env.useMock && !!realAddress },
  });

  const switchNetwork = useCallback(() => {
    if (seamArmed()) mock.switchChain();
    else switchChain?.({ chainId: REDEEM_CHAIN_NUM_ID });
  }, [mock, switchChain]);

  // Balance shortfall is only asserted against a KNOWN balance — an unknown
  // balance stays optimistic here (the backend pre-check and the contract are the
  // backstops), it must never be treated as zero.
  const insufficientBalance =
    isConnected && amountUsdx > 0 && balanceUsdx != null && balanceUsdx < amountUsdx;

  // ── Mock seam path ────────────────────────────────────────────────────────
  if (seamArmed()) {
    const chainOk = isConnected && mock.chainId === REDEEM_CHAIN_NUM_ID;
    const lowGasWarning = isConnected && mock.gasPol < REDEEM_MIN_GAS_POL;
    return {
      isConnected,
      address,
      connect,
      chainOk,
      switchNetwork,
      isSwitchingNetwork: false,
      balanceUsdx,
      insufficientBalance,
      lowGasWarning,
      canBurn: isConnected && chainOk && !insufficientBalance,
    };
  }

  // ── Real wagmi path ───────────────────────────────────────────────────────
  const chainOk = isConnected && currentChainId === REDEEM_CHAIN_NUM_ID;
  const gasPol = gasRead.data != null ? Number(formatUnits(gasRead.data.value, gasRead.data.decimals)) : null;
  const lowGasWarning = isConnected && gasPol != null && gasPol < REDEEM_MIN_GAS_POL;

  return {
    isConnected,
    address,
    connect,
    chainOk,
    switchNetwork,
    isSwitchingNetwork,
    balanceUsdx,
    insufficientBalance,
    lowGasWarning,
    canBurn: isConnected && chainOk && !insufficientBalance,
  };
}
