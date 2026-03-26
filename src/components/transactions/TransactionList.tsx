"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useTransactions } from "@/hooks/useTransactions";
import { getChainById } from "@/lib/chains";
import { formatAmount, formatDate, truncateAddress } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Transaction, TransactionStatus } from "@/types";

const statusStyles: Record<TransactionStatus, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={`text-xs capitalize ${
          row.original.type === "mint"
            ? "bg-primary-100 text-primary-700"
            : "bg-orange-100 text-orange-700"
        }`}
      >
        {row.original.type}
      </Badge>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="text-sm font-semibold tabular-nums">
        {formatAmount(row.original.amount)} USDX
      </span>
    ),
  },
  {
    accessorKey: "chainId",
    header: "Chain",
    cell: ({ row }) => {
      const chain = getChainById(row.original.chainId);
      return (
        <div className="flex items-center gap-1.5 text-sm">
          {chain?.icon && (
            <img src={chain.icon} alt="" className="h-4 w-4 rounded-full" />
          )}
          {chain?.shortName ?? "Unknown"}
        </div>
      );
    },
  },
  {
    accessorKey: "txHash",
    header: "Tx Hash",
    cell: ({ row }) => {
      const chain = getChainById(row.original.chainId);
      const explorerUrl = chain?.explorerUrl;
      const hash = row.original.txHash;
      return explorerUrl ? (
        <a
          href={`${explorerUrl}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono text-primary hover:underline"
        >
          {truncateAddress(hash, 6)}
        </a>
      ) : (
        <span className="text-sm font-mono text-muted-foreground">
          {truncateAddress(hash, 6)}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={`text-xs capitalize ${statusStyles[row.original.status]}`}
      >
        {row.original.status}
      </Badge>
    ),
  },
];

export function TransactionList() {
  const { data: transactions = [], isLoading } = useTransactions();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (isLoading) {
    return <TransactionListSkeleton />;
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transactions yet
      </div>
    );
  }

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-primary-100 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary-50">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-semibold uppercase tracking-wide text-primary-900 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      <ArrowUpDown className="h-3 w-3 text-primary-400" />
                    </div>
                  </TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                className={`hover:bg-primary-50/50 transition-colors ${
                  i % 2 === 0 ? "bg-white" : "bg-primary-50/20"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2.5 px-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {table.getRowModel().rows.map((row) => {
          const tx = row.original;
          const chain = getChainById(tx.chainId);
          return (
            <div
              key={tx.id}
              className="rounded-xl border border-primary-100 bg-white p-4 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className={`text-xs capitalize ${
                    tx.type === "mint"
                      ? "bg-primary-100 text-primary-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {tx.type}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-xs capitalize ${statusStyles[tx.status]}`}
                >
                  {tx.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold tabular-nums">
                  {formatAmount(tx.amount)} USDX
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {chain?.icon && (
                    <img src={chain.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                  )}
                  {chain?.shortName}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(tx.createdAt)}</span>
                <a
                  href={`${chain?.explorerUrl}/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-primary hover:underline"
                >
                  {truncateAddress(tx.txHash, 6)}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
