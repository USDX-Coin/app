"use client";

// Contextual wallet connect for redeem (USDX-243). Redeem is the only flow that
// needs a wallet (the user burns USDX from their own wallet) — there is no
// global connect button (W2 principle). This wraps wagmi/RainbowKit so the
// redeem form can ask "connected?" and open the connect modal in-flow.
//
// The connection is REAL even when the API layer is mocked. Only the on-chain
// burn is simulated in W3 (see lib/redeem/burn.ts); the real writeContract lands
// in INT-1 (USDX-249).

import { useCallback } from "react";
import { create } from "zustand";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { env } from "@/lib/env";

// E2E seam (mock-only): Playwright has no wallet extension, so when this
// localStorage key is armed connect() flips to a deterministic mock address
// instead of opening RainbowKit — letting the full redeem flow run offline.
// Mirrors the KYC_OVERRIDE_KEY / retry-after seams in the mock layer. Real users
// (and dev with a real wallet) always go through RainbowKit.
const MOCK_WALLET_SEAM_KEY = "usdx-mock-wallet";
const MOCK_WALLET_ADDRESS = "0xC0FFEE0000000000000000000000000000C0FFEE";

function seamArmed(): boolean {
  return (
    env.useMock &&
    typeof localStorage !== "undefined" &&
    localStorage.getItem(MOCK_WALLET_SEAM_KEY) != null
  );
}

// Shared across hook instances (form, Ringkasan modal, tracker) so they all see
// the same mock connection — wagmi's real `useAccount` is already global; this
// gives the seam the same shared semantics without a wallet extension.
const useMockWalletStore = create<{ connected: boolean; connect: () => void }>((set) => ({
  connected: false,
  connect: () => set({ connected: true }),
}));

export interface RedeemWallet {
  isConnected: boolean;
  address: string | undefined;
  connect: () => void;
}

export function useRedeemWallet(): RedeemWallet {
  const account = useAccount();
  const { openConnectModal } = useConnectModal();
  const mockConnected = useMockWalletStore((s) => s.connected);
  const mockConnect = useMockWalletStore((s) => s.connect);

  const connect = useCallback(() => {
    if (seamArmed()) mockConnect();
    else openConnectModal?.();
  }, [mockConnect, openConnectModal]);

  if (seamArmed()) {
    return {
      isConnected: mockConnected,
      address: mockConnected ? MOCK_WALLET_ADDRESS : undefined,
      connect,
    };
  }
  return { isConnected: account.isConnected, address: account.address, connect };
}
