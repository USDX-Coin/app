"use client";

// Contextual wallet connect + precondition gate for redeem (USDX-243, hardened
// USDX-259). Redeem is the only flow that needs a wallet (the user burns USDX from
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
  const balanceUsdx = balRaw != null && Number.isFinite(Number(balRaw)) ? Number(balRaw) : 1_000_000;
  const gasRaw = localStorage.getItem(MOCK_WALLET_GAS_KEY);
  const gasPol = gasRaw != null && Number.isFinite(Number(gasRaw)) ? Number(gasRaw) : 1;
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
  balanceUsdx: 1_000_000,
  gasPol: 1,
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
  const gasRead = useBalance({
    address: realAddress,
    chainId: REDEEM_CHAIN_NUM_ID,
    query: { enabled: !env.useMock && !!realAddress },
  });

  const connect = useCallback(() => {
    if (seamArmed()) mock.connect();
    else openConnectModal?.();
  }, [mock, openConnectModal]);

  const switchNetwork = useCallback(() => {
    if (seamArmed()) mock.switchChain();
    else switchChain?.({ chainId: REDEEM_CHAIN_NUM_ID });
  }, [mock, switchChain]);

  // ── Mock seam path ────────────────────────────────────────────────────────
  if (seamArmed()) {
    const isConnected = mock.connected;
    const balanceUsdx = isConnected ? mock.balanceUsdx : null;
    const insufficientBalance =
      isConnected && amountUsdx > 0 && balanceUsdx != null && balanceUsdx < amountUsdx;
    const chainOk = isConnected && mock.chainId === REDEEM_CHAIN_NUM_ID;
    const lowGasWarning = isConnected && mock.gasPol < REDEEM_MIN_GAS_POL;
    return {
      isConnected,
      address: isConnected ? mock.address : undefined,
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
  const isConnected = account.isConnected;
  const chainOk = isConnected && currentChainId === REDEEM_CHAIN_NUM_ID;
  const balanceUsdx =
    balanceRead.data != null ? Number(formatUnits(balanceRead.data, USDX_DECIMALS)) : null;
  const insufficientBalance =
    isConnected && amountUsdx > 0 && balanceUsdx != null && balanceUsdx < amountUsdx;
  const gasPol = gasRead.data != null ? Number(formatUnits(gasRead.data.value, gasRead.data.decimals)) : null;
  const lowGasWarning = isConnected && gasPol != null && gasPol < REDEEM_MIN_GAS_POL;

  return {
    isConnected,
    address: realAddress,
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
