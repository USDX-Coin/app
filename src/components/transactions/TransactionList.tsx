"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { getChainById, SUPPORTED_CHAINS } from "@/lib/chains";
import { formatAmount, formatDate, truncateAddress, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import { ArrowUpRight, ArrowDownLeft, ChevronDown, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import type { Transaction, TransactionStatus } from "@/types";

const statusStyles: Record<TransactionStatus, string> = {
  completed: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const statusLabels: Record<TransactionStatus, string> = {
  completed: "SUCCESS",
  pending: "PENDING",
  failed: "FAILED",
};

function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const dateKey = formatDate(tx.createdAt);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(tx);
  }
  return groups;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied!");
}

const typeOptions = [
  { value: "all", label: "All Transactions" },
  { value: "mint", label: "Mint" },
  { value: "redeem", label: "Redeem" },
];

const networkOptions = [
  { value: "all", label: "All Networks" },
  ...SUPPORTED_CHAINS.map((c) => ({ value: c.id, label: c.name })),
];

export function TransactionList() {
  const { data: transactions = [], isLoading } = useTransactions();
  const [typeFilter, setTypeFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (networkFilter !== "all" && tx.chainId !== networkFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const chain = getChainById(tx.chainId);
        return (
          tx.txHash.toLowerCase().includes(q) ||
          tx.type.includes(q) ||
          tx.status.includes(q) ||
          chain?.name.toLowerCase().includes(q) ||
          String(tx.amount).includes(q)
        );
      }
      return true;
    });
  }, [transactions, typeFilter, networkFilter, searchQuery]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  if (isLoading) return <TransactionListSkeleton />;

  if (!transactions.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={typeOptions}
        />
        <FilterSelect
          value={networkFilter}
          onChange={setNetworkFilter}
          options={networkOptions}
        />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl bg-white"
          />
        </div>
      </div>

      {/* Transaction Rows Grouped by Date */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No transactions match your filters
        </div>
      ) : (
        Object.entries(grouped).map(([date, txs]) => (
          <div key={date}>
            <h3 className="text-base font-semibold text-foreground mb-3">{date}</h3>
            <div className="space-y-2">
              {txs.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? options[0].label;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-48">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between px-4 w-full rounded-xl border border-border h-11 bg-white text-sm transition-colors hover:border-primary/50 cursor-pointer"
      >
        <span className="text-foreground truncate mr-2">{selectedLabel}</span>
        <ChevronDown
          className={cn(
            "text-primary shrink-0 transition-transform duration-200 h-4 w-4",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors",
                value === opt.value && "text-primary font-medium"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const chain = getChainById(tx.chainId);
  const time = new Date(tx.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white border border-border p-4 hover:shadow-sm transition-shadow">
      {/* Icon */}
      <div
        className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
          tx.type === "mint"
            ? "bg-primary-50 text-primary"
            : "bg-orange-50 text-orange-600"
        }`}
      >
        {tx.type === "mint" ? (
          <ArrowDownLeft className="h-5 w-5" />
        ) : (
          <ArrowUpRight className="h-5 w-5" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          {/* Left: type, time, chain, hash */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-sm font-semibold capitalize">{tx.type}</span>
              <span className="text-xs text-muted-foreground">{time}</span>
              {chain && (
                <Badge variant="outline" className="text-xs gap-1 py-0 h-5">
                  {chain.icon && (
                    <img src={chain.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                  )}
                  {chain.shortName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-muted-foreground">To</span>
              <span className="text-xs font-mono text-muted-foreground">
                {truncateAddress(tx.txHash, 4)}
              </span>
              <button
                onClick={() => copyToClipboard(tx.txHash)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Right: status + amount stacked */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${statusStyles[tx.status]}`}
            >
              {statusLabels[tx.status]}
            </Badge>
            <span className="text-sm font-semibold tabular-nums">
              {formatAmount(tx.amount)} USDX
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
