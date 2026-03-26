"use client";

import { useTransactions } from "@/hooks/useTransactions";
import { getChainById } from "@/lib/chains";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import type { TransactionStatus } from "@/types";

const statusStyles: Record<TransactionStatus, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
};

export function TransactionList() {
  const { data: transactions, isLoading } = useTransactions();

  if (isLoading) {
    return <TransactionListSkeleton />;
  }

  if (!transactions?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transactions yet
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Date</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Amount</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Chain</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Tx Hash</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx, i) => {
              const chain = getChainById(tx.chainId);
              return (
                <TableRow key={tx.id} className={`hover:bg-muted/50 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-xs capitalize ${
                        tx.type === "mint"
                          ? "bg-primary/10 text-primary"
                          : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-semibold tabular-nums">
                    {formatAmount(tx.amount)} USDX
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {chain?.icon && (
                        <img src={chain.icon} alt="" className="h-4 w-4 rounded-full" />
                      )}
                      {chain?.shortName ?? "Unknown"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {truncateAddress(tx.txHash, 6)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${statusStyles[tx.status]}`}
                    >
                      {tx.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {transactions.map((tx) => {
          const chain = getChainById(tx.chainId);
          return (
            <div
              key={tx.id}
              className="rounded-xl border border-border bg-white p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-semibold capitalize ${
                    tx.type === "mint"
                      ? "text-primary"
                      : "text-orange-600"
                  }`}
                >
                  {tx.type}
                </span>
                <Badge
                  variant="secondary"
                  className={statusStyles[tx.status]}
                >
                  {tx.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">
                  {formatAmount(tx.amount)} USDX
                </span>
                <span className="text-xs text-muted-foreground">
                  {chain?.shortName ?? "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                <span className="font-mono">
                  {truncateAddress(tx.txHash, 6)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
