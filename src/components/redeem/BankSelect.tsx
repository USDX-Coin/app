"use client";

// Destination bank dropdown for redeem (USDX-243). Lists the curated ID bank
// set (lib/banks.ts) and emits the selected `bankCode` — sent verbatim in
// POST /v2/redeem. There's no saved bank-account book; bank details are entered
// inline per order (redeem.yaml CreateRedeemOrder).

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import { BANKS, getBankByCode } from "@/lib/banks";

interface BankSelectProps {
  value: string; // bankCode
  onSelect: (code: string) => void;
}

export function BankSelect({ value, onSelect }: BankSelectProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = getBankByCode(value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={t("form.selectBank")}
        className="flex w-full items-center gap-2.5 rounded-md bg-muted p-3 text-left"
      >
        <span
          className={cn(
            "flex-1 truncate text-sm",
            selected ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {selected ? selected.name : t("form.selectBank")}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {BANKS.map((bank) => (
            <button
              key={bank.code}
              type="button"
              onClick={() => {
                onSelect(bank.code);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                value === bank.code && "bg-primary/10",
              )}
            >
              {bank.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
