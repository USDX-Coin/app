"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  MoreHorizontal,
  ServerCrash,
  SlidersHorizontal,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useTransactions } from "@/hooks/useTransactions";
import { useRedeemStore } from "@/stores/redeemStore";
import { getChainById } from "@/lib/chains";
import { getFailureKey } from "@/lib/api/errors";
import { formatDateTime, formatIDR, formatTokenAmount, truncateAddress, cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import type {
  ConsumerOrderType,
  ConsumerTransaction,
  MintOrderStatus,
  MintPaymentStatus,
  RedeemStatus,
} from "@/types";

const PAGE_SIZE = 10;

// Badge per derived status. EXPIRED and HELD come from `paymentStatus` (the
// order's overall `status` reads FAILED / HELD alongside them), so each gets its
// own pill. Papan 26 § derivation: EXPIRED wins over FAILED because the Expiry
// Handler writes both at once.
type BadgeKey = MintOrderStatus | "EXPIRED";
const statusLabelKey: Record<BadgeKey, string> = {
  COMPLETED: "tx.st.completed",
  WAITING_FOR_PAYMENT: "tx.st.waitingPayment",
  WAITING_FOR_APPROVAL: "tx.st.waitingApproval",
  FAILED: "tx.st.failed",
  EXPIRED: "tx.st.expired",
  HELD: "tx.st.held",
};

function badgeKey(status: MintOrderStatus, paymentStatus: MintPaymentStatus): BadgeKey {
  if (paymentStatus === "EXPIRED") return "EXPIRED";
  if (paymentStatus === "HELD") return "HELD";
  return status;
}

// Per-type icon + brand color (matches Figma: mint=green, redeem=amber).
const typeMeta: Record<ConsumerOrderType, { icon: typeof ArrowDownToLine; color: string; key: string }> = {
  MINT: { icon: ArrowDownToLine, color: "text-success-text", key: "tx.minting" },
  REDEEM: { icon: ArrowUpFromLine, color: "text-warning-text", key: "tx.redeem" },
};

// Redeem status labels (USDX-244). Reuses the redeem.status* labels (USDX-243);
// the colour is no longer decided here — `StatusBadge` owns the status→tone map
// so Riwayat, KYC, Profil and checkout can never disagree again (C7, C11).
const redeemStatusLabelKey: Record<RedeemStatus, string> = {
  AWAITING_BURN: "redeem.statusAwaitingBurn",
  BURNED: "redeem.statusBurned",
  PROCESSING_PAYOUT: "redeem.statusProcessing",
  PAYOUT_COMPLETE: "tx.st.completed",
  EXPIRED: "redeem.statusExpired",
};

// Type-aware IDR values: the "Subtotal" column is the pre-fee value (mint
// subtotal / redeem gross); the "Total" column is the settled value (mint total
// paid / redeem net received).
function subtotalValue(tx: ConsumerTransaction): string | null {
  return tx.type === "REDEEM" ? tx.grossIdr : tx.subtotalIdr;
}
function totalValue(tx: ConsumerTransaction): string | null {
  return tx.type === "REDEEM" ? tx.netPayoutIdr : tx.totalPayIdr;
}

// Block explorer tx link for the order's chain, or null when the chain has no
// known explorer or the tx hasn't landed on-chain yet (txHash null).
function explorerTxUrl(chain: string, txHash: string | null): string | null {
  if (!txHash) return null;
  const url = getChainById(chain)?.explorerUrl;
  return url ? `${url}/tx/${txHash}` : null;
}

/** Page list with ellipsis: 1 2 3 … 8 9 10 */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total - 2, total - 1, total];
  if (current >= total - 2) return [1, 2, 3, "…", total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

// UI filter value → API `type` param. Union mint + redeem (USDX-244).
const typeParam: Record<string, ConsumerOrderType | undefined> = {
  all: undefined,
  mint: "MINT",
  redeem: "REDEEM",
};

/**
 * B1 — the four outcomes this page can have, and they must never look alike.
 * Before this, a 500 and a dead network both rendered the exact "Tidak Ada
 * Transaksi" screen a brand-new account gets, so someone with fifty orders was
 * told they had none.
 *
 *   empty   — the account really has no orders   → Empty + "Mint sekarang"
 *   filter  — orders exist, this filter hides them → Empty + "Tampilkan semua"
 *   error   — the server answered with a failure → Alert danger + "Coba lagi"
 *   offline — the request never reached a server → Alert warning + "Coba lagi"
 *
 * `error` vs `offline` is read off the thrown value (`getFailureKey`), not off
 * `navigator.onLine`: fetch rejects with a TypeError when the network is gone
 * and never with a status, while `navigator.onLine` lies in both directions —
 * a captive portal is "online", and an aborted request leaves the flag alone.
 */
type ListState = "data" | "empty" | "filter" | "error" | "offline";

export function TransactionList() {
  const router = useRouter();
  const { t, lang } = useLang();
  const resumeRedeem = useRedeemStore((s) => s.resumeOrder);
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Resume an unburned redeem from history (USDX-259): load it into the tracker
  // and navigate to /redeem. The `?order=` param makes resume deep-linkable and
  // survive a full reload; the store update is the SPA fast-path.
  function continueBurn(id: string) {
    resumeRedeem(id);
    router.push(`/redeem?order=${id}`);
  }

  const query = useTransactions({
    page,
    take: PAGE_SIZE,
    type: typeParam[typeFilter],
  });
  const { data, isLoading, isError, error, isFetching, refetch } = query;
  const rows = data?.data ?? [];
  const total = data?.metadata.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const filtered = typeFilter !== "all";

  // `getFailureKey` is the one place that tells a dead network (fetch rejects
  // with a TypeError, no status) apart from a server that answered badly.
  const networkDown = isError && getFailureKey(error) === "error.offline";
  const state: ListState = isError
    ? networkDown
      ? "offline"
      : "error"
    : rows.length > 0
      ? "data"
      : filtered
        ? "filter"
        : "empty";

  const typeOptions = [
    { value: "all", label: t("tx.allTransaction") },
    { value: "mint", label: t("tx.minting") },
    { value: "redeem", label: t("tx.redeem") },
  ];

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("toast.copied"));
  }

  function changeFilter(next: string) {
    setTypeFilter(next);
    setPage(1);
  }

  if (isLoading) return <TransactionListSkeleton />;

  function TypeCell({ type }: { type: ConsumerOrderType }) {
    const meta = typeMeta[type];
    const Icon = meta.icon;
    return (
      <span className="flex items-center gap-2 text-foreground">
        <Icon className={cn("size-4 shrink-0", meta.color)} />
        {t(meta.key)}
      </span>
    );
  }

  function AmountCell({ amount }: { amount: string }) {
    return (
      <span className="flex items-center justify-end gap-1.5 tabular-nums text-foreground">
        <img src="/image/usdx-coin.svg" alt="" className="size-4 rounded-full" />
        {formatTokenAmount(amount, lang)}
      </span>
    );
  }

  function TxHashCell({ tx }: { tx: ConsumerTransaction }) {
    const url = explorerTxUrl(tx.chain, tx.txHash);
    if (!tx.txHash) return <span className="text-muted-text">—</span>;
    return (
      <span className="flex items-center gap-1 text-foreground">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-text underline-offset-4 hover:underline"
          >
            {truncateAddress(tx.txHash, 4)}
          </a>
        ) : (
          truncateAddress(tx.txHash, 4)
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copy(tx.txHash!)}
              aria-label={t("common.copy")}
              className="text-muted-text"
            >
              <Copy className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("common.copy")}</TooltipContent>
        </Tooltip>
      </span>
    );
  }

  function StatusPill({ tx }: { tx: ConsumerTransaction }) {
    const isRedeem = tx.type === "REDEEM";
    const status = isRedeem
      ? (tx.status as RedeemStatus)
      : badgeKey(tx.status as MintOrderStatus, tx.paymentStatus ?? "REQUESTED");
    const labelKey = isRedeem
      ? redeemStatusLabelKey[status as RedeemStatus]
      : statusLabelKey[status as BadgeKey];
    return <StatusBadge status={status}>{t(labelKey)}</StatusBadge>;
  }

  /**
   * Menu ⋯ per baris (Figma 8). Figma memasang tiga entri: "Lihat detail",
   * "Buka di explorer", "Salin hash". "Lihat detail" butuh Sheet detail +
   * Steps timeline yang belum ada di produk, jadi ia TIDAK dirender — entri
   * menu yang tidak membuka apa pun lebih buruk daripada menu berisi dua.
   *
   * Dua entri yang tersisa sama-sama butuh tx hash. Baris yang belum mendarat
   * on-chain karena itu tidak dapat pemicu sama sekali, bukan tombol yang
   * membuka menu kosong. Kolomnya tetap ada supaya lebar tabel tidak bergoyang
   * antar baris.
   */
  function RowActions({ tx }: { tx: ConsumerTransaction }) {
    const url = explorerTxUrl(tx.chain, tx.txHash);
    if (!tx.txHash) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("tx.rowActions")}
            className="text-muted-text"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {url && (
            // `asChild` is stripped by the Animate UI item, so this cannot be an
            // `<a>`; `noopener` is passed explicitly instead of inherited from
            // `rel`.
            <DropdownMenuItem
              onSelect={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink />
              {t("tx.openExplorer")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => copy(tx.txHash!)}>
            <Copy />
            {t("tx.copyHash")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function chainLabel(chain: string) {
    return getChainById(chain)?.name ?? chain;
  }

  function idrOrDash(value: string | null) {
    return value == null ? "—" : formatIDR(Number(value));
  }

  const retryButton = (
    <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
      {t("common.retry")}
    </Button>
  );

  function Body() {
    if (state === "error" || state === "offline") {
      const down = state === "offline";
      return (
        <Alert
          tone={down ? "warning" : "danger"}
          title={t(down ? "state.offline.title" : "tx.loadFailed.title")}
          action={retryButton}
          icon={down ? <WifiOff /> : <ServerCrash />}
        >
          {t(down ? "state.offline.desc" : "tx.loadFailed.desc")}
        </Alert>
      );
    }

    if (state === "filter") {
      return (
        <Empty className="rounded-2xl border border-border">
          <EmptyHeader>
            <EmptyMedia kind="filter" />
            <EmptyTitle>{t("tx.emptyFilter")}</EmptyTitle>
            <EmptyDescription>{t("tx.emptyFilterDesc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => changeFilter("all")}>
              <SlidersHorizontal />
              {t("tx.clearFilter")}
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    if (state === "empty") {
      return (
        <Empty className="rounded-2xl border border-border">
          <EmptyHeader>
            <EmptyMedia kind="empty">
              <History />
            </EmptyMedia>
            <EmptyTitle>{t("tx.empty")}</EmptyTitle>
            <EmptyDescription>{t("tx.emptyDesc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => router.push("/mint")}>{t("tx.mintNow")}</Button>
          </EmptyContent>
        </Empty>
      );
    }

    return (
      <>
        {/* Desktop table */}
        {/* A2: the table turns on at `lg`, not `md`. At 768px the 272px sidebar is
            still showing, leaving the table 456px -- the Status column fell off the
            edge. Cards carry tablet instead. Do not lower this without also
            collapsing the sidebar. */}
        <div className="hidden lg:block">
          {/* The wrapper is a keyboard-reachable scroll region now, so it needs a
              name of its own — "Tabel, dapat digulir ke samping" says nothing
              about WHICH table when a page grows a second one. */}
          <Table scrollLabel={t("tx.tableScroll")}>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {/* Penanda urut, bukan tombol urut. Daftar ini memang selalu
                    `created_at desc` (transactions.yaml), jadi `aria-sort` di
                    sini menyatakan fakta. Membalik urutan butuh param `sort` di
                    API yang belum ada — sampai itu ada, header ini tidak boleh
                    bisa diklik: sorting klien di halaman yang dipaginasi server
                    hanya mengurutkan 10 baris yang kebetulan terlihat. */}
                <TableHead aria-sort="descending">
                  <span className="flex items-center gap-1.5">
                    {t("tx.dateTime")}
                    <ArrowDown className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{t("tx.sortedNewest")}</span>
                  </span>
                </TableHead>
                <TableHead>{t("tx.transaction")}</TableHead>
                <TableHead className="text-right">{t("tx.amount")}</TableHead>
                <TableHead className="text-right">{t("tx.subtotal")}</TableHead>
                <TableHead className="text-right">{t("tx.totalPay")}</TableHead>
                <TableHead>{t("tx.chain")}</TableHead>
                <TableHead>{t("tx.txHash")}</TableHead>
                {/* 212 px = lebar sel Status di Figma; ia harus memuat badge
                    terpanjang ("Menunggu pembayaran") dan pasangan
                    "Menunggu burn" + "Lanjutkan" berdampingan. */}
                <TableHead className="w-[212px]">{t("tx.status")}</TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">{t("tx.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-text">{formatDateTime(tx.createdAt, lang)}</TableCell>
                  <TableCell><TypeCell type={tx.type} /></TableCell>
                  <TableCell className="text-right"><AmountCell amount={tx.amount} /></TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{idrOrDash(subtotalValue(tx))}</TableCell>
                  {/* Total adalah angka yang benar-benar berpindah tangan —
                      Figma memberinya Nominal/Tabel Medium supaya ia menonjol
                      dari Subtotal di sebelahnya. */}
                  <TableCell className="text-right font-medium tabular-nums text-foreground">{idrOrDash(totalValue(tx))}</TableCell>
                  <TableCell className="text-foreground">{chainLabel(tx.chain)}</TableCell>
                  <TableCell><TxHashCell tx={tx} /></TableCell>
                  <TableCell className="w-[212px]">
                    <div className="flex items-center gap-2">
                      <StatusPill tx={tx} />
                      {tx.type === "REDEEM" && tx.status === "AWAITING_BURN" && (
                        <Button variant="link" size="sm" className="h-auto px-0" onClick={() => continueBurn(tx.id)}>
                          {t("redeem.resume")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-14 text-right"><RowActions tx={tx} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col gap-3 lg:hidden">
          {rows.map((tx) => (
            <div key={tx.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-text">{formatDateTime(tx.createdAt, lang)}</span>
                <StatusPill tx={tx} />
              </div>
              <div className="flex items-center justify-between">
                <TypeCell type={tx.type} />
                <AmountCell amount={tx.amount} />
              </div>
              <CardRow label={t("tx.subtotal")} value={idrOrDash(subtotalValue(tx))} />
              <CardRow label={t("tx.totalPay")} value={idrOrDash(totalValue(tx))} />
              <CardRow label={t("tx.chain")} value={chainLabel(tx.chain)} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-text">{t("tx.txHash")}</span>
                <TxHashCell tx={tx} />
              </div>
              {tx.type === "REDEEM" && tx.status === "AWAITING_BURN" && (
                <Button className="mt-1 w-full" onClick={() => continueBurn(tx.id)}>
                  {t("redeem.resume")}
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Pagination. `PaginationLink` is an `<a>`, which this page cannot use:
            the page number lives in component state, not in the URL, and
            prev/next need a real `disabled` — a disabled anchor does not exist. */}
        {totalPages > 1 && (
          <Pagination className="justify-between">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft /> {t("tx.previous")}
            </Button>
            <PaginationContent className="hidden sm:flex">
              {pageList(currentPage, totalPages).map((p, i) => (
                <PaginationItem key={p === "…" ? `e${i}` : p}>
                  {p === "…" ? (
                    <PaginationEllipsis />
                  ) : (
                    <Button
                      variant={p === currentPage ? "brand" : "ghost"}
                      size="icon-sm"
                      className="rounded-full"
                      aria-current={p === currentPage ? "page" : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )}
                </PaginationItem>
              ))}
            </PaginationContent>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {t("tx.next")} <ChevronRight />
            </Button>
          </Pagination>
        )}
      </>
    );
  }

  return (
    // The type filter is a segmented control, not a menu: three options that are
    // always visible read faster than a dropdown hiding two of them, and Tabs
    // brings the roles, Escape and arrow keys the old hand-rolled div never had
    // (C3). Polygon-only in W2, so there is no network filter.
    <Tabs value={typeFilter} onValueChange={changeFilter} className="flex flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <TabsList aria-label={t("tx.filterLabel")}>
          {typeOptions.map((o) => (
            <TabsTrigger key={o.value} value={o.value}>
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Radix gives the panel `tabIndex=0` so a keyboard user can step from the
          triggers into the list, but `TabsContent` ships with `outline-none` and
          nothing to replace it — it was the one control on /history that took focus
          and showed nothing (1 of 74 in the a11y sweep). The ring is the same
          `ring-2 ring-focus-ring` every other control uses; `rounded-xl` keeps it
          off the square corners of the table inside. */}
      {typeOptions.map((o) => (
        <TabsContent
          key={o.value}
          value={o.value}
          className="flex flex-col gap-4 rounded-xl focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Body />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-text">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
