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

const config = getDefaultConfig({
  appName: "USDX",
  projectId: "usdx-demo-project-id",
  chains: [base, mainnet, polygon, bsc, arbitrum, optimism, avalanche],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
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
