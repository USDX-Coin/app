import type { Chain } from "@/types";

export const SUPPORTED_CHAINS: Chain[] = [
  {
    id: "base",
    name: "Base",
    shortName: "Base",
    icon: "/chains/base.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://basescan.org",
  },
  {
    id: "lisk",
    name: "Lisk",
    shortName: "Lisk",
    icon: "/chains/lisk.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://liskscan.com",
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    shortName: "BSC",
    icon: "/chains/bsc.svg",
    contractAddress: "0x5678...USDX",
    explorerUrl: "https://bscscan.com",
  },
  {
    id: "polygon",
    name: "Polygon",
    shortName: "Polygon",
    icon: "/chains/polygon.svg",
    contractAddress: "0x5678...USDX",
    explorerUrl: "https://polygonscan.com",
  },
  {
    id: "etherlink",
    name: "Etherlink",
    shortName: "Etherlink",
    icon: "/chains/etherlink.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://explorer.etherlink.com",
  },
  {
    id: "kaia",
    name: "Kaia",
    shortName: "Kaia",
    icon: "/chains/kaia.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://kaiascan.io",
  },
  {
    id: "monad",
    name: "Monad",
    shortName: "Monad",
    icon: "/chains/monad.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://monad.xyz",
  },
];

const CHAIN_MAP = new Map(SUPPORTED_CHAINS.map((c) => [c.id, c]));

export function getChainById(id: string): Chain | undefined {
  return CHAIN_MAP.get(id);
}

export const DEFAULT_CHAIN_ID = "base";
