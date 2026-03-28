"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { mockGetBankAccounts } from "@/lib/api/mock-api";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BankAccountSelectorProps {
  value: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function BankAccountSelector({ value, onSelect, disabled }: BankAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: mockGetBankAccounts,
  });

  const selectedAccount = accounts.find((a) => a.id === value);

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
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          "flex gap-4 items-center justify-start px-4 w-full rounded-[8px] border border-border h-20 bg-background transition-colors",
          disabled ? "opacity-70 cursor-default" : "cursor-pointer hover:border-primary/50"
        )}
      >
        {selectedAccount ? (
          <div className="flex flex-col items-start gap-0.5 text-left">
            <span className="font-medium text-foreground">{selectedAccount.bankName}</span>
            <span className="text-xs text-muted-foreground">
              {selectedAccount.accountNumber} · {selectedAccount.accountHolder}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Choose Bank Account</span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto text-primary shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          size={18}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-white border border-border rounded-[8px] shadow-lg overflow-hidden">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                onSelect(account.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex flex-col items-start px-4 py-3 hover:bg-muted/50 transition-colors text-left",
                value === account.id && "bg-primary/5"
              )}
            >
              <span className="font-medium text-foreground text-sm">{account.bankName}</span>
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
