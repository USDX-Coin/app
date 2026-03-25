"use client";

import { useState, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { SUPPORTED_CHAINS, getChainById } from "@/lib/chains";
import { truncateAddress } from "@/lib/utils";
import type { Chain } from "@/types";

interface ChainSelectorProps {
  selectedChainId: string;
  onSelect: (chainId: string) => void;
}

export const ChainSelector = memo(function ChainSelector({
  selectedChainId,
  onSelect,
}: ChainSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedChain = getChainById(selectedChainId);

  const filteredChains = SUPPORTED_CHAINS.filter((chain) =>
    chain.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(chain: Chain) {
    onSelect(chain.id);
    setOpen(false);
    setSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 rounded-full px-3 py-1.5 h-auto text-sm"
        >
          <ChainIcon chain={selectedChain} />
          <span>
            USDX on {selectedChain?.shortName ?? "Select"}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Select Network</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search network..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        <div className="flex flex-wrap gap-2 mb-3">
          {SUPPORTED_CHAINS.slice(0, 5).map((chain) => (
            <button
              key={chain.id}
              onClick={() => handleSelect(chain)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                selectedChainId === chain.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              title={chain.name}
            >
              <ChainIcon chain={chain} size="sm" />
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-1">
          {filteredChains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => handleSelect(chain)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted transition-colors"
            >
              <ChainIcon chain={chain} />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  USDX{" "}
                  <span className="text-muted-foreground">
                    {chain.shortName}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {truncateAddress(chain.contractAddress)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});

function ChainIcon({
  chain,
  size = "md",
}: {
  chain?: Chain;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-5 w-5" : "h-8 w-8";
  return (
    <div
      className={`${sizeClass} rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary`}
    >
      {chain?.shortName?.[0] ?? "?"}
    </div>
  );
}
