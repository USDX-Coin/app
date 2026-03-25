"use client";

import { useState, useMemo } from "react";
import { SUPPORTED_CHAINS } from "@/lib/chains";

export function useChainSelector() {
  const [search, setSearch] = useState("");

  const filteredChains = useMemo(
    () =>
      SUPPORTED_CHAINS.filter((chain) =>
        chain.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  return {
    search,
    setSearch,
    filteredChains,
    allChains: SUPPORTED_CHAINS,
  };
}
