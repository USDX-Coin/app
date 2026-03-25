"use client";

import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, http } from "wagmi";
import { base, bsc, polygon, lisk } from "wagmi/chains";

const config = getDefaultConfig({
  appName: "USDX",
  projectId: "usdx-demo-project-id",
  chains: [base, polygon, bsc, lisk],
  transports: {
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [lisk.id]: http(),
  },
});

export function WalletProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}
