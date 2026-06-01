"use client";

import { Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { SUPPORTED_CHAINS, getChainById } from "@/lib/chains";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

interface NetworkTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  selectedChainId: string;
  onSelectChain: (chainId: string) => void;
}

/** Shared network + token picker ("Mint to" / "Redeem From" / "Bridge From" / "Send From"). */
export function NetworkTokenModal({
  open,
  onOpenChange,
  title,
  selectedChainId,
  onSelectChain,
}: NetworkTokenModalProps) {
  const selected = getChainById(selectedChainId);
  const { t } = useLang();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-4 border-white/20 p-0 sm:max-w-[520px]">
        <div className="border-b border-border p-4">
          <DialogTitle className="text-base font-medium text-foreground">{title}</DialogTitle>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-muted-foreground">{t("modal.selectedNetwork")}</span>
            <span className="flex items-center gap-1.5">
              {selected && <img src={selected.icon} alt="" className="size-4 rounded-sm" />}
              <span className="text-sm text-foreground">{selected?.name}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUPPORTED_CHAINS.map((c) => {
              const active = c.id === selectedChainId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.name}
                  onClick={() => onSelectChain(c.id)}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-lg border transition-colors",
                    active
                      ? "border-primary bg-primary/15 ring-2 ring-primary/40"
                      : "border-border bg-card hover:bg-accent"
                  )}
                >
                  <img src={c.icon} alt="" className="size-6" />
                </button>
              );
            })}
          </div>

          <p className="text-sm font-medium text-muted-foreground">{t("modal.token")}</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-primary bg-primary/15 p-3 text-left"
          >
            <img src="/image/usdx-logo.png" alt="" className="size-8 rounded-full" />
            <span className="flex-1">
              <span className="block text-sm font-medium text-foreground">USDX</span>
              <span className="block text-xs text-muted-foreground">USD Dollar Index</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wallet className="size-[18px]" /> 0
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
