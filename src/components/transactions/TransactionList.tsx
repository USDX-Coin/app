"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useTransactions } from "@/hooks/useTransactions";
import { getChainById } from "@/lib/chains";
import { formatAmount, formatIDR, truncateAddress, cn } from "@/lib/utils";
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
import type {
  ConsumerOrderType,
  ConsumerTransaction,
  MintOrderStatus,
  MintPaymentStatus,
} from "@/types";

const PAGE_SIZE = 10;

// Badge per derived status. EXPIRED comes from `paymentStatus` (the order's
// overall `status` is FAILED then), so we surface it as its own pill.
type BadgeKey = MintOrderStatus | "EXPIRED";
const statusStyles: Record<BadgeKey, string> = {
  COMPLETED: "bg-success/15 text-success",
  WAITING_FOR_PAYMENT: "bg-warning/15 text-warning",
  WAITING_FOR_APPROVAL: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  FAILED: "bg-destructive/15 text-destructive",
  EXPIRED: "bg-muted text-muted-foreground",
};
const statusLabelKey: Record<BadgeKey, string> = {
  COMPLETED: "tx.st.completed",
  WAITING_FOR_PAYMENT: "tx.st.waitingPayment",
  WAITING_FOR_APPROVAL: "tx.st.waitingApproval",
  FAILED: "tx.st.failed",
  EXPIRED: "tx.st.expired",
};

function badgeKey(status: MintOrderStatus, paymentStatus: MintPaymentStatus): BadgeKey {
  return paymentStatus === "EXPIRED" ? "EXPIRED" : status;
}

// Block explorer tx link for the order's chain, or null when the chain has no
// known explorer or the tx hasn't landed on-chain yet (txHash null).
function explorerTxUrl(chain: string, txHash: string | null): string | null {
  if (!txHash) return null;
  const url = getChainById(chain)?.explorerUrl;
  return url ? `${url}/tx/${txHash}` : null;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const mo = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mo} ${day}, ${d.getFullYear()} - ${hh}:${mm}`;
}

/** Page list with ellipsis: 1 2 3 … 8 9 10 */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total - 2, total - 1, total];
  if (current >= total - 2) return [1, 2, 3, "…", total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

// UI filter value → API `type` param. Week 2 is mint-only; REDEEM is W3 (the
// option renders disabled), so only "mint" maps to a server filter today.
const typeParam: Record<string, ConsumerOrderType | undefined> = {
  all: undefined,
  mint: "MINT",
};

export function TransactionList() {
  const router = useRouter();
  const { t } = useLang();
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useTransactions({
    page,
    take: PAGE_SIZE,
    type: typeParam[typeFilter],
  });
  const rows = data?.data ?? [];
  const total = data?.metadata.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const typeOptions = [
    { value: "all", label: t("tx.allTransaction") },
    { value: "mint", label: t("tx.minting") },
    { value: "redeem", label: t("tx.redeemSoon"), disabled: true },
  ];

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("toast.copied"));
  }

  if (isLoading) return <TransactionListSkeleton />;

  function TypeCell() {
    // Mint-only in W2; the icon/label stay union-ready for REDEEM (W3).
    return (
      <span className="flex items-center gap-2 text-foreground">
        <ArrowDownToLine className="size-4 shrink-0 text-green-600 dark:text-green-500" />
        {t("tx.minting")}
      </span>
    );
  }

  function AmountCell({ amount }: { amount: string }) {
    return (
      <span className="flex items-center gap-1.5 font-medium text-foreground">
        <img src="/image/usdx-logo.png" alt="" className="size-4 rounded-full" />
        {formatAmount(Number(amount))}
      </span>
    );
  }

  function TxHashCell({ tx }: { tx: ConsumerTransaction }) {
    const url = explorerTxUrl(tx.chain, tx.txHash);
    if (!tx.txHash) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="flex items-center gap-1.5 text-foreground">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            {truncateAddress(tx.txHash, 6)}
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          truncateAddress(tx.txHash, 6)
        )}
        <button
          onClick={() => copy(tx.txHash!)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={t("common.copy")}
        >
          <Copy className="size-3.5" />
        </button>
      </span>
    );
  }

  function StatusPill({ tx }: { tx: ConsumerTransaction }) {
    const key = badgeKey(tx.status, tx.paymentStatus);
    return (
      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", statusStyles[key])}>
        {t(statusLabelKey[key])}
      </span>
    );
  }

  function chainLabel(chain: string) {
    return getChainById(chain)?.name ?? chain;
  }

  function idrOrDash(value: string | null) {
    return value == null ? "—" : formatIDR(Number(value));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter (type) — Polygon-only in W2, so no network filter. */}
      <div className="flex justify-end">
        <FilterSelect
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
          options={typeOptions}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState onMint={() => router.push("/mint")} t={t} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-muted-foreground">{t("tx.dateTime")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.transaction")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.amount")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.subtotal")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.totalPay")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.rate")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.chain")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.txHash")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("tx.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tx) => (
                  <TableRow key={tx.id} className="border-border">
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(tx.createdAt)}</TableCell>
                    <TableCell><TypeCell /></TableCell>
                    <TableCell><AmountCell amount={tx.amount} /></TableCell>
                    <TableCell className="whitespace-nowrap text-foreground">{idrOrDash(tx.subtotalIdr)}</TableCell>
                    <TableCell className="whitespace-nowrap text-foreground">{idrOrDash(tx.totalPayIdr)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{idrOrDash(tx.effectiveRate)}</TableCell>
                    <TableCell className="text-foreground">{chainLabel(tx.chain)}</TableCell>
                    <TableCell><TxHashCell tx={tx} /></TableCell>
                    <TableCell><StatusPill tx={tx} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((tx) => (
              <div key={tx.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{formatDateTime(tx.createdAt)}</span>
                  <StatusPill tx={tx} />
                </div>
                <div className="flex items-center justify-between">
                  <TypeCell />
                  <AmountCell amount={tx.amount} />
                </div>
                <CardRow label={t("tx.subtotal")} value={idrOrDash(tx.subtotalIdr)} />
                <CardRow label={t("tx.totalPay")} value={idrOrDash(tx.totalPayIdr)} />
                <CardRow label={t("tx.rate")} value={idrOrDash(tx.effectiveRate)} />
                <CardRow label={t("tx.chain")} value={chainLabel(tx.chain)} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("tx.txHash")}</span>
                  <TxHashCell tx={tx} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
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
          )}
        </>
      )}
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
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
  options: { value: string; label: string; disabled?: boolean }[];
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
    <div ref={ref} className="relative w-44">
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
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                opt.disabled
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : "hover:bg-accent",
                value === opt.value && !opt.disabled && "font-medium text-primary"
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
