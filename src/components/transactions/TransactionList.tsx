"use client";

import { useState, useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { getChainById } from "@/lib/chains";
import { formatAmount, formatDate, truncateAddress } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import { ArrowUpRight, ArrowDownLeft, Copy, Search } from "lucide-react";
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="rounded-xl bg-white sm:w-48">
            <SelectValue placeholder="All Transactions" />
          </SelectTrigger>
          <SelectContent className="bg-white border border-border shadow-lg">
            <SelectItem value="all">All Transactions</SelectItem>
            <SelectItem value="mint">Mint</SelectItem>
            <SelectItem value="redeem">Redeem</SelectItem>
          </SelectContent>
        </Select>

        <Select value={networkFilter} onValueChange={setNetworkFilter}>
          <SelectTrigger className="rounded-xl bg-white sm:w-48">
            <SelectValue placeholder="All Networks" />
          </SelectTrigger>
          <SelectContent className="bg-white border border-border shadow-lg">
            <SelectItem value="all">All Networks</SelectItem>
            <SelectItem value="base">Base</SelectItem>
            <SelectItem value="ethereum">Ethereum</SelectItem>
            <SelectItem value="polygon">Polygon</SelectItem>
            <SelectItem value="bsc">BSC</SelectItem>
            <SelectItem value="arbitrum">Arbitrum</SelectItem>
            <SelectItem value="optimism">Optimism</SelectItem>
            <SelectItem value="avalanche">Avalanche</SelectItem>
            <SelectItem value="solana">Solana</SelectItem>
          </SelectContent>
        </Select>

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

function TransactionRow({ tx }: { tx: Transaction }) {
  const chain = getChainById(tx.chainId);
  const time = new Date(tx.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="flex items-center gap-4 rounded-xl bg-white border border-border p-4 hover:shadow-sm transition-shadow">
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

      {/* Type + Time + Chain */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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
            {truncateAddress(tx.txHash, 6)}
          </span>
          <button
            onClick={() => copyToClipboard(tx.txHash)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <span className="text-sm font-semibold tabular-nums">
          {formatAmount(tx.amount)} USDX
        </span>
      </div>

      {/* Status */}
      <Badge
        variant="outline"
        className={`text-xs font-semibold shrink-0 ${statusStyles[tx.status]}`}
      >
        {statusLabels[tx.status]}
      </Badge>
    </div>
  );
}
