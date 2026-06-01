"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { mockGetBankAccounts } from "@/lib/api/mock-api";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

interface BankAccountSelectorProps {
  value: string;
  onSelect: (id: string) => void;
}

export function BankAccountSelector({ value, onSelect }: BankAccountSelectorProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: mockGetBankAccounts,
  });

  const selected = accounts.find((a) => a.id === value);

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
        className="flex w-full items-center gap-2.5 rounded-md bg-muted p-3 text-left"
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{selected.bankName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {selected.accountNumber} · {selected.accountHolder}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">{t("form.selectBank")}</span>
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {accounts.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">No saved accounts</p>
          )}
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                onSelect(account.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full flex-col items-start px-3 py-3 text-left transition-colors hover:bg-accent",
                value === account.id && "bg-primary/10"
              )}
            >
              <span className="text-sm font-medium text-foreground">{account.bankName}</span>
              <span className="text-xs text-muted-foreground">
                {account.accountNumber} · {account.accountHolder}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
