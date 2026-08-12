"use client";

import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, http } from "wagmi";
import { polygon } from "wagmi/chains";
import { WALLETCONNECT_PROJECT_ID, POLYGON_RPC_URL } from "@/lib/constants";

// Polygon-only (Phase 2 = Polygon-only; mint/redeem both hardcode "polygon").
// Configuring just Polygon avoids RainbowKit/wagmi polling other chains' public
// RPCs — in particular the Ethereum-mainnet endpoint (eth.merkle.io) used for ENS
// + block watching, which otherwise gets spammed (429s) for no benefit here.
// pollingInterval also throttles the block watcher (default 4s → 12s).
//
// projectId / RPC come from env via constants (USDX-263): without a real
// WalletConnect id the remote config 403s and only injected wallets work; the
// Polygon transport uses the dedicated RPC since the default public RPC
// (polygon-rpc.com) is disabled/rate-limited.
const config = getDefaultConfig({
  appName: "USDX",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [polygon],
  transports: {
    [polygon.id]: http(POLYGON_RPC_URL || undefined),
  },
  pollingInterval: 12_000,
});

export function WalletProviders({ children }: { children: React.ReactNode }) {
  // reconnectOnMount={false}: redeem starts with a "Connect Wallet" button every
  // load; the wallet (and its balance) is only read after the user connects.
  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}
