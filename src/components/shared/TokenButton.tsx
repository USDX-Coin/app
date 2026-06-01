"use client";

import { ChevronDown } from "lucide-react";
import type { Chain } from "@/types";
import { cn } from "@/lib/utils";

/** Maroon USDX pill with optional network badge + dropdown chevron (opens NetworkTokenModal). */
export function TokenButton({
  chain,
  onClick,
  className = "",
}: {
  chain?: Chain;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-white",
        className
      )}
    >
      <span className="relative inline-block size-8 shrink-0">
        <img src="/image/Logo.svg" alt="" className="size-8 rounded-full" />
        {chain && (
          <img
            src={chain.icon}
            alt=""
            className="absolute -bottom-0.5 -right-0.5 size-[14px] rounded-full border border-primary bg-card"
          />
        )}
      </span>
      <span className="text-base font-semibold tracking-tight">USDX</span>
      <ChevronDown className="size-5" />
    </button>
  );
}
