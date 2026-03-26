import type { Chain } from "@/types";

export const SUPPORTED_CHAINS: Chain[] = [
  {
    id: "base",
    name: "Base",
    shortName: "Base",
    icon: "/icon/base.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://basescan.org",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    icon: "/icon/ethereum.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://etherscan.io",
  },
  {
    id: "polygon",
    name: "Polygon",
    shortName: "Polygon",
    icon: "/icon/polygon.svg",
    contractAddress: "0x5678...USDX",
    explorerUrl: "https://polygonscan.com",
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    shortName: "BSC",
    icon: "/icon/bnb.svg",
    contractAddress: "0x5678...USDX",
    explorerUrl: "https://bscscan.com",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    shortName: "Arbitrum",
    icon: "/icon/arbitrum.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://arbiscan.io",
  },
  {
    id: "optimism",
    name: "Optimism",
    shortName: "OP",
    icon: "/icon/optimism.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://optimistic.etherscan.io",
  },
  {
    id: "avalanche",
    name: "Avalanche",
    shortName: "AVAX",
    icon: "/icon/avalanche.svg",
    contractAddress: "0x1234...USDX",
    explorerUrl: "https://snowtrace.io",
  },
  {
    id: "solana",
    name: "Solana",
    shortName: "Solana",
    icon: "/icon/solana.svg",
    contractAddress: "usdx...wDur",
    explorerUrl: "https://solscan.io",
  },
];

const CHAIN_MAP = new Map(SUPPORTED_CHAINS.map((c) => [c.id, c]));

export function getChainById(id: string): Chain | undefined {
  return CHAIN_MAP.get(id);
}

export const DEFAULT_CHAIN_ID = "base";
