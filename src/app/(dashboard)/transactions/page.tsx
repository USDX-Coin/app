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
import { Loader2 } from "lucide-react";
import type { TransactionStatus } from "@/types";

const statusStyles: Record<TransactionStatus, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
};

export default function TransactionsPage() {
  const { data: transactions, isLoading } = useTransactions();

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-6">Transactions</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !transactions?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          No transactions yet
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Tx Hash</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const chain = getChainById(tx.chainId);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-medium capitalize ${
                            tx.type === "mint"
                              ? "text-primary"
                              : "text-orange-600"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatAmount(tx.amount)} USDX
                      </TableCell>
                      <TableCell className="text-sm">
                        {chain?.shortName}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {truncateAddress(tx.txHash, 6)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusStyles[tx.status]}
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
                  className="rounded-xl border border-border bg-white p-4 space-y-2"
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
                      {chain?.shortName}
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
      )}
    </div>
  );
}
