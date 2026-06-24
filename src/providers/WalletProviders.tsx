"use client";

import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, http } from "wagmi";
import {
  base,
  mainnet,
  polygon,
  bsc,
  arbitrum,
  optimism,
  avalanche,
} from "wagmi/chains";
import { WALLETCONNECT_PROJECT_ID, POLYGON_RPC_URL } from "@/lib/constants";

const config = getDefaultConfig({
  appName: "USDX",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [base, mainnet, polygon, bsc, arbitrum, optimism, avalanche],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
    // Redeem burn + balanceOf run on Polygon — use the configured RPC when set
    // (reliable real reads), else wagmi's default public endpoint (USDX-263).
    [polygon.id]: http(POLYGON_RPC_URL || undefined),
    [bsc.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [avalanche.id]: http(),
  },
});

export function WalletProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}
