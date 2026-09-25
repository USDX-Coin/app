"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  ServerCrash,
  SlidersHorizontal,
  Wallet,
  WifiOff,
} from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useRedeemStore } from "@/stores/redeemStore";
import { getChainById } from "@/lib/chains";
import { getFailureKey } from "@/lib/api/errors";
import { isTransferItem } from "@/lib/history-item";
import {
  formatDateTime,
  formatIDR,
  isSameAddress,
  cn,
} from "@/lib/utils";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import { PagePagination } from "@/components/shared/PagePagination";
import { AmountCell, RowActions, TxHashCell } from "@/components/transactions/HistoryCells";
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
  // USDX-664: a human-readable label, never the raw code. `Record<RedeemStatus, …>`
  // is what makes a new status enum value a compile error instead of a grey pill.
  PAYOUT_FAILED: "redeem.statusPayoutFailed",
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

  // "Wallet custodial saya" marker (USDX-653, custodial-wallet.md §5.2): the order
  // has no custodial flag, so the row's `userAddress` is matched against the
  // user's wallet address, case-insensitively — a mint may store it all
  // lowercase. The address comes from the profile summary (`/auth/me`) or the
  // shared wallet query; a user without a wallet triggers no request and gets no
  // marker. Never a per-row detail call.
  const custodialAddress = useCustodialWallet().address;
  // Sementara: baris transfer belum dirender (belum pernah diminta — tab lama saja).
  const rows = (data?.data ?? []).filter((r): r is ConsumerTransaction => !isTransferItem(r));
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

  function CustodialMarker({ tx }: { tx: ConsumerTransaction }) {
    if (!isSameAddress(tx.userAddress, custodialAddress)) return null;
    return (
      <span
        data-testid="tx-custodial-marker"
        className="flex items-center gap-1 text-xs text-muted-text"
      >
        <Wallet className="size-3.5 shrink-0" aria-hidden />
        {/* The mint review's label, word for word (USDX-653: "samakan dengan label
            tujuan custodial di review mint") — one key, so the two never drift. The
            row's type (Minting / Redeem) already says destination vs burn source. */}
        {t("mint.destCustodial")}
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
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <TypeCell type={tx.type} />
                      <CustodialMarker tx={tx} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right"><AmountCell amount={tx.amount} /></TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{idrOrDash(subtotalValue(tx))}</TableCell>
                  {/* Total adalah angka yang benar-benar berpindah tangan —
                      Figma memberinya Nominal/Tabel Medium supaya ia menonjol
                      dari Subtotal di sebelahnya. */}
                  <TableCell className="text-right font-medium tabular-nums text-foreground">{idrOrDash(totalValue(tx))}</TableCell>
                  <TableCell className="text-foreground">{chainLabel(tx.chain)}</TableCell>
                  <TableCell><TxHashCell chain={tx.chain} txHash={tx.txHash} /></TableCell>
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
                  <TableCell className="w-14 text-right"><RowActions chain={tx.chain} txHash={tx.txHash} /></TableCell>
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
                <div className="flex flex-col gap-0.5">
                  <TypeCell type={tx.type} />
                  <CustodialMarker tx={tx} />
                </div>
                <AmountCell amount={tx.amount} />
              </div>
              <CardRow label={t("tx.subtotal")} value={idrOrDash(subtotalValue(tx))} />
              <CardRow label={t("tx.totalPay")} value={idrOrDash(totalValue(tx))} />
              <CardRow label={t("tx.chain")} value={chainLabel(tx.chain)} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-text">{t("tx.txHash")}</span>
                <TxHashCell chain={tx.chain} txHash={tx.txHash} />
              </div>
              {tx.type === "REDEEM" && tx.status === "AWAITING_BURN" && (
                <Button className="mt-1 w-full" onClick={() => continueBurn(tx.id)}>
                  {t("redeem.resume")}
                </Button>
              )}
            </div>
          ))}
        </div>

        <PagePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
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
