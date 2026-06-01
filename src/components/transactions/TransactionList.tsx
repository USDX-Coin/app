"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useTransactions } from "@/hooks/useTransactions";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { formatAmount, truncateAddress, cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import type { Transaction, TransactionStatus, TransactionType } from "@/types";

const PAGE_SIZE = 8;

const statusStyles: Record<TransactionStatus, string> = {
  completed: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  failed: "bg-destructive/15 text-destructive",
};
const typeIcons: Record<TransactionType, typeof ArrowDownLeft> = {
  mint: ArrowDownLeft,
  redeem: ArrowUpRight,
  bridge: ArrowLeftRight,
  send: ArrowUpRight,
};
const typeKey: Record<TransactionType, string> = {
  mint: "tx.minting",
  redeem: "tx.redeem",
  bridge: "tx.bridge",
  send: "tx.send",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function TransactionList() {
  const router = useRouter();
  const { t } = useLang();
  const { data: transactions = [], isLoading } = useTransactions();
  const [typeFilter, setTypeFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [page, setPage] = useState(1);

  const typeOptions = [
    { value: "all", label: t("tx.allTransaction") },
    { value: "mint", label: t("tx.minting") },
    { value: "redeem", label: t("tx.redeem") },
    { value: "bridge", label: t("tx.bridge") },
    { value: "send", label: t("tx.send") },
  ];
  const networkOptions = [
    { value: "all", label: t("tx.allNetwork") },
    ...SUPPORTED_CHAINS.map((c) => ({ value: c.id, label: c.name })),
  ];

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("toast.copied"));
  }

  const filtered = useMemo(
    () =>
      transactions.filter((tx) => {
        if (typeFilter !== "all" && tx.type !== typeFilter) return false;
        if (networkFilter !== "all" && tx.chainId !== networkFilter) return false;
        return true;
      }),
    [transactions, typeFilter, networkFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (isLoading) return <TransactionListSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground">
          <Calendar className="size-4 text-muted-foreground" />
          02 - 30 April 2026
        </button>
        <div className="flex gap-3">
          <FilterSelect value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={typeOptions} />
          <FilterSelect value={networkFilter} onChange={(v) => { setNetworkFilter(v); setPage(1); }} options={networkOptions} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState onMint={() => router.push("/mint")} t={t} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t("tx.dateTime")}</TableHead>
                  <TableHead>{t("tx.txHash")}</TableHead>
                  <TableHead>{t("tx.transaction")}</TableHead>
                  <TableHead>{t("tx.amount")}</TableHead>
                  <TableHead>{t("tx.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((tx) => {
                  const Icon = typeIcons[tx.type];
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground">{formatDateTime(tx.createdAt)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 font-mono text-foreground">
                          {truncateAddress(tx.txHash, 4)}
                          <button onClick={() => copy(tx.txHash)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="size-3.5" />
                          </button>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 text-foreground">
                          <Icon className="size-4 text-muted-foreground" />
                          {t(typeKey[tx.type])}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <img src="/image/usdx-logo.png" alt="" className="size-4 rounded-full" />
                          {formatAmount(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", statusStyles[tx.status])}>
                          {t(`tx.${tx.status}`)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {pageItems.map((tx) => {
              const Icon = typeIcons[tx.type];
              return (
                <div key={tx.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{formatDateTime(tx.createdAt)}</span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Icon className="size-4 text-muted-foreground" />
                      {t(typeKey[tx.type])}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("tx.txHash")}</span>
                    <span className="flex items-center gap-1.5 font-mono text-foreground">
                      {truncateAddress(tx.txHash, 4)}
                      <button onClick={() => copy(tx.txHash)} className="text-muted-foreground"><Copy className="size-3.5" /></button>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("tx.amount")}</span>
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <img src="/image/usdx-logo.png" alt="" className="size-4 rounded-full" />{formatAmount(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("tx.status")}</span>
                    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", statusStyles[tx.status])}>
                      {t(`tx.${tx.status}`)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-4" /> {t("tx.previous")}
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                    p === currentPage ? "brand-gradient text-white" : "text-foreground hover:bg-accent"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-40"
            >
              {t("tx.next")} <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ onMint, t }: { onMint: () => void; t: (k: string) => string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-border py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <History className="size-6" />
      </div>
      <p className="text-base font-medium text-foreground">{t("tx.empty")}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{t("tx.emptyDesc")}</p>
      <button onClick={onMint} className="brand-gradient mt-1 rounded-lg px-5 py-2 text-sm font-medium text-white">
        {t("tx.mintNow")}
      </button>
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
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative w-40">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                value === opt.value && "font-medium text-primary"
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
