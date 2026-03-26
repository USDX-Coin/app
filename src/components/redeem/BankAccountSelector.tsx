"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockGetBankAccounts } from "@/lib/api/mock-api";

interface BankAccountSelectorProps {
  value: string;
  onSelect: (id: string) => void;
}

export function BankAccountSelector({
  value,
  onSelect,
}: BankAccountSelectorProps) {
  const { data: accounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: mockGetBankAccounts,
  });

  return (
    <Select value={value} onValueChange={onSelect}>
      <SelectTrigger className="rounded-xl h-14">
        <SelectValue placeholder="Choose Bank Account" />
      </SelectTrigger>
      <SelectContent className="bg-white border border-border shadow-lg">
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{account.bankName}</span>
              <span className="text-muted-foreground text-xs">
                {account.accountNumber}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
