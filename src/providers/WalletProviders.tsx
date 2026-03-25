"use client";

import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, http } from "wagmi";
import { base, bsc, polygon, lisk } from "wagmi/chains";
import { defineChain } from "viem";

const etherlink = defineChain({
  id: 42793,
  name: "Etherlink",
  nativeCurrency: { name: "XTZ", symbol: "XTZ", decimals: 18 },
  rpcUrls: { default: { http: ["https://node.mainnet.etherlink.com"] } },
});

const kaia = defineChain({
  id: 8217,
  name: "Kaia",
  nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
  rpcUrls: { default: { http: ["https://public-en.node.kaia.io"] } },
});

const monad = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  testnet: true,
});

const config = getDefaultConfig({
  appName: "USDX",
  projectId: "usdx-demo-project-id",
  chains: [base, polygon, bsc, lisk, etherlink, kaia, monad],
  transports: {
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [lisk.id]: http(),
    [etherlink.id]: http(),
    [kaia.id]: http(),
    [monad.id]: http(),
  },
});

export function WalletProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}
