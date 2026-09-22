"use client";

// Riwayat transfer keluar dari wallet custodial (USDX-701, wallet.yaml § transfers).
// Pola layar /history (TransactionList): tabel mulai `lg`, kartu di bawahnya,
// pagination server (page/take), urutan PERSIS dari API (terbaru dulu — tidak ada
// pengurutan klien di halaman yang dipaginasi server).
//
// Empat keadaan yang tidak boleh terlihat sama (pelajaran USDX-497):
//   data    — baris dari API
//   empty   — 200 dengan daftar kosong (juga user tanpa wallet) → Empty + "Kirim USDX"
//   error   — server menjawab gagal → Alert danger + "Coba lagi"
//   offline — permintaan tidak sampai ke server → Alert warning + "Coba lagi"
// Endpoint ini tidak punya 503; 429 ditangani toast terpusat + tombol coba lagi.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ChevronRight, Send, ServerCrash, WifiOff } from "lucide-react";
import { useWalletTransfers } from "@/hooks/useWalletTransfers";
import { getFailureKey } from "@/lib/api/errors";
import { getChainById } from "@/lib/chains";
import { formatDateTime, formatTokenAmount, truncateAddress } from "@/lib/utils";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PagePagination } from "@/components/shared/PagePagination";
import { TransferStatusBadge } from "@/components/transfer/TransferStatusBadge";
import type { WalletTransfer } from "@/types";

export const TRANSFER_HISTORY_PAGE_SIZE = 10;

type ListState = "data" | "empty" | "error" | "offline";

export function TransferHistoryList() {
  const router = useRouter();
  const { t, lang } = useLang();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching, refetch } = useWalletTransfers({
    page,
    take: TRANSFER_HISTORY_PAGE_SIZE,
  });

  if (isLoading) return <TransferHistorySkeleton />;

  const rows = data?.data ?? [];
  const total = data?.metadata.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / TRANSFER_HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const state: ListState = isError
    ? getFailureKey(error) === "error.offline"
      ? "offline"
      : "error"
    : rows.length > 0
      ? "data"
      : "empty";

  if (state === "error" || state === "offline") {
    const down = state === "offline";
    return (
      <Alert
        tone={down ? "warning" : "danger"}
        title={t(down ? "state.offline.title" : "transfer.history.loadFailed.title")}
        icon={down ? <WifiOff /> : <ServerCrash />}
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
            {t("common.retry")}
          </Button>
        }
        data-testid="transfer-history-error"
      >
        {t(down ? "state.offline.desc" : "transfer.history.loadFailed.desc")}
      </Alert>
    );
  }

  if (state === "empty") {
    return (
      <Empty className="rounded-2xl border border-border" data-testid="transfer-history-empty">
        <EmptyHeader>
          <EmptyMedia kind="empty">
            <Send />
          </EmptyMedia>
          <EmptyTitle>{t("transfer.history.empty")}</EmptyTitle>
          <EmptyDescription>{t("transfer.history.emptyDesc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => router.push("/send")}>{t("transfer.history.sendNow")}</Button>
        </EmptyContent>
      </Empty>
    );
  }

  const detailHref = (tr: WalletTransfer) => `/send/history/${encodeURIComponent(tr.id)}`;

  return (
    <div className="flex flex-col gap-4" data-testid="transfer-history">
      {/* Tabel mulai `lg`, sama dengan /history (A2): di 768px sidebar masih tampil. */}
      <div className="hidden lg:block">
        <Table scrollLabel={t("transfer.history.tableScroll")}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {/* Penanda urut, bukan tombol: API selalu terbaru dulu. */}
              <TableHead aria-sort="descending">
                <span className="flex items-center gap-1.5">
                  {t("tx.dateTime")}
                  <ArrowDown className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">{t("tx.sortedNewest")}</span>
                </span>
              </TableHead>
              <TableHead>{t("transfer.history.to")}</TableHead>
              <TableHead className="text-right">{t("tx.amount")}</TableHead>
              <TableHead>{t("tx.chain")}</TableHead>
              <TableHead>{t("tx.status")}</TableHead>
              <TableHead className="w-32">
                <span className="sr-only">{t("tx.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((tr) => (
              <TableRow key={tr.id} data-testid="transfer-history-row">
                <TableCell className="text-muted-text">{formatDateTime(tr.submittedAt, lang)}</TableCell>
                <TableCell className="text-foreground" title={tr.to}>
                  {truncateAddress(tr.to, 6)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {formatTokenAmount(tr.amount, lang)} USDX
                </TableCell>
                <TableCell className="text-foreground">{getChainById(tr.chain)?.name ?? tr.chain}</TableCell>
                <TableCell>
                  <TransferStatusBadge transfer={tr} />
                </TableCell>
                <TableCell className="w-32 text-right">
                  <Button variant="link" size="sm" className="h-auto px-0" asChild>
                    <Link href={detailHref(tr)}>{t("transfer.history.detail")}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {rows.map((tr) => (
          <Link
            key={tr.id}
            href={detailHref(tr)}
            className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-control hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-focus-ring"
            data-testid="transfer-history-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-text">{formatDateTime(tr.submittedAt, lang)}</span>
              <TransferStatusBadge transfer={tr} />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-text">
                {t("transfer.history.to")} {truncateAddress(tr.to, 6)}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {formatTokenAmount(tr.amount, lang)} USDX
              </span>
            </div>
            <span className="flex items-center justify-end gap-1 text-sm text-primary-text">
              {t("transfer.history.detail")}
              <ChevronRight className="size-4" />
            </span>
          </Link>
        ))}
      </div>

      <PagePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

function TransferHistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" data-testid="transfer-history-loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} shape="block" className="h-16 w-full" />
      ))}
    </div>
  );
}
