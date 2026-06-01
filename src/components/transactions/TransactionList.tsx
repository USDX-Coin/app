"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  MoreHorizontal,
  RefreshCcw,
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

const PAGE_SIZE = 10;

const statusStyles: Record<TransactionStatus, string> = {
  completed: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  failed: "bg-destructive/15 text-destructive",
};

// Per-type icon + brand color (matches Figma: mint=green, redeem=amber, bridge=blue, send=red).
const typeMeta: Record<TransactionType, { icon: typeof ArrowDownToLine; color: string; key: string }> = {
  mint: { icon: ArrowDownToLine, color: "text-green-600 dark:text-green-500", key: "tx.minting" },
  redeem: { icon: RefreshCcw, color: "text-amber-600 dark:text-amber-500", key: "tx.redeem" },
  bridge: { icon: ArrowLeftRight, color: "text-sky-600 dark:text-sky-500", key: "tx.bridge" },
  send: { icon: ArrowUpRight, color: "text-rose-600 dark:text-rose-500", key: "tx.send" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const mo = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mo} ${day},${d.getFullYear()} - ${hh}:${mm}`;
}

/** Page list with ellipsis: 1 2 3 … 8 9 10 */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total - 2, total - 1, total];
  if (current >= total - 2) return [1, 2, 3, "…", total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

export function TransactionList() {
  const router = useRouter();
  const { t } = useLang();
  const { data: transactions = [], isLoading } = useTransactions();
  const [typeFilter, setTypeFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: "date" | "hash"; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });

  function toggleSort(key: "date" | "hash") {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }

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

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cmp =
        sort.key === "date"
          ? a.createdAt.localeCompare(b.createdAt)
          : a.txHash.localeCompare(b.txHash);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (isLoading) return <TransactionListSkeleton />;

  function TypeCell({ tx }: { tx: Transaction }) {
    const meta = typeMeta[tx.type];
    const Icon = meta.icon;
    return (
      <span className="flex items-center gap-2 text-foreground">
        <Icon className={cn("size-4 shrink-0", meta.color)} />
        {t(meta.key)}
      </span>
    );
  }
  function AmountCell({ tx }: { tx: Transaction }) {
    return (
      <span className="flex items-center gap-1.5 font-medium text-foreground">
        <img src="/image/usdx-logo.png" alt="" className="size-4 rounded-full" />
        {formatAmount(tx.amount)}
      </span>
    );
  }
  function StatusPill({ status }: { status: TransactionStatus }) {
    return (
      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", statusStyles[status])}>
        {t(`tx.${status}`)}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
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
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-muted-foreground">
                    <button onClick={() => toggleSort("date")} className="flex items-center gap-1 hover:text-foreground">
                      {t("tx.dateTime")} <ChevronsUpDownSmall />
                    </button>
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    <button onClick={() => toggleSort("hash")} className="flex items-center gap-1 hover:text-foreground">
                      {t("tx.txHash")} <ChevronsUpDownSmall />
                    </button>
                  </TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.transaction")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.amount")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.status")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((tx) => (
                  <TableRow key={tx.id} className="border-border">
                    <TableCell className="text-muted-foreground">{formatDateTime(tx.createdAt)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-foreground">
                        {truncateAddress(tx.txHash, 6)}
                        <button onClick={() => copy(tx.txHash)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="size-3.5" />
                        </button>
                      </span>
                    </TableCell>
                    <TableCell><TypeCell tx={tx} /></TableCell>
                    <TableCell><AmountCell tx={tx} /></TableCell>
                    <TableCell><StatusPill status={tx.status} /></TableCell>
                    <TableCell>
                      <button aria-label="Actions" className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {pageItems.map((tx) => (
              <div key={tx.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{formatDateTime(tx.createdAt)}</span>
                  <TypeCell tx={tx} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("tx.txHash")}</span>
                  <span className="flex items-center gap-1.5 text-foreground">
                    {truncateAddress(tx.txHash, 6)}
                    <button onClick={() => copy(tx.txHash)} className="text-muted-foreground"><Copy className="size-3.5" /></button>
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("tx.amount")}</span>
                  <AmountCell tx={tx} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("tx.status")}</span>
                  <StatusPill status={tx.status} />
                </div>
                <button className="mt-1 flex h-9 items-center justify-center rounded-md border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent">
                  {t("tx.viewDetails")}
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-4" /> {t("tx.previous")}
            </button>
            <div className="hidden items-center gap-1 sm:flex">
              {pageList(currentPage, totalPages).map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="flex size-8 items-center justify-center text-sm text-muted-foreground">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                      p === currentPage ? "brand-gradient text-white" : "text-foreground hover:bg-accent"
                    )}
                  >
                    {p}
                  </button>
                )
              )}
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

function ChevronsUpDownSmall() {
  return (
    <span className="flex flex-col text-muted-foreground/60">
      <ChevronDown className="size-3 -rotate-180" />
      <ChevronDown className="-mt-1 size-3" />
    </span>
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
