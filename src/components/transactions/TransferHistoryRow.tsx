"use client";

// Baris transfer USDX wallet custodial di /history (USDX-713, custodial-wallet.md §5.7,
// transactions.yaml § TransferHistoryItem). Satu bentuk untuk tabel (`lg` ke atas) dan
// satu untuk kartu (di bawahnya), mengikuti baris order di TransactionList.
//
//   Keluar — tujuan (alamat, dipendekkan), jumlah, status; FAILED tetap tampil dengan
//            kalimat tracker USDX-701 ("USDX tidak berpindah, aman kirim ulang").
//            Membuka detail/tracker /send/history/[id] (id = WalletTransfer.id).
//   Masuk  — pengirim (ALAMAT SAJA, tidak pernah nama user lain), jumlah, status.
//            Menu baris = buka explorer + salin hash (pola mint/redeem); tanpa detail.
//
// Status dibaca lewat `transferStatusOf` (nilai tak dikenal = "Menunggu konfirmasi").
// Penanda "Wallet custodial saya" (USDX-653) sengaja TIDAK dipasang: transfer selalu
// wallet custodial user sendiri, `userAddress` hanya informasi.

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { getChainById } from "@/lib/chains";
import { formatDateTime, truncateAddress, cn } from "@/lib/utils";
import { transferStatusOf } from "@/lib/wallet-transfer";
import { useLang } from "@/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { TransferStatusBadge } from "@/components/transfer/TransferStatusBadge";
import { AmountCell, RowActions, TxHashCell } from "@/components/transactions/HistoryCells";
import type { TransferHistoryItem } from "@/types";

const DIRECTION = {
  TRANSFER_IN: { icon: ArrowDownLeft, color: "text-success-text", label: "tx.transferIn", party: "tx.from" },
  TRANSFER_OUT: { icon: ArrowUpRight, color: "text-info-text", label: "tx.transferOut", party: "tx.to" },
} as const;

const detailHref = (item: TransferHistoryItem) => `/send/history/${encodeURIComponent(item.id)}`;

function DirectionCell({ item }: { item: TransferHistoryItem }) {
  const { t } = useLang();
  const meta = DIRECTION[item.type];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 text-foreground">
        <Icon className={cn("size-4 shrink-0", meta.color)} />
        {t(meta.label)}
      </span>
      <span className="text-xs text-muted-text" title={item.counterpartyAddress}>
        {t(meta.party)} {truncateAddress(item.counterpartyAddress, 6)}
      </span>
    </div>
  );
}

function Status({ item }: { item: TransferHistoryItem }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-start gap-1">
      <TransferStatusBadge transfer={item} />
      {transferStatusOf(item) === "FAILED" && (
        <span className="text-xs text-muted-text">{t("transfer.tracker.failedDesc")}</span>
      )}
    </div>
  );
}

export function TransferTableRow({ item }: { item: TransferHistoryItem }) {
  const { t, lang } = useLang();
  return (
    <TableRow data-testid="history-transfer-row">
      <TableCell className="text-muted-text">{formatDateTime(item.createdAt, lang)}</TableCell>
      <TableCell>
        <DirectionCell item={item} />
      </TableCell>
      <TableCell className="text-right">
        <AmountCell amount={item.amount} />
      </TableCell>
      {/* Transfer tidak punya nilai IDR (bukan order). */}
      <TableCell className="text-right text-muted-text">—</TableCell>
      <TableCell className="text-right text-muted-text">—</TableCell>
      <TableCell className="text-foreground">{getChainById(item.chain)?.name ?? item.chain}</TableCell>
      <TableCell>
        <TxHashCell chain={item.chain} txHash={item.txHash} />
      </TableCell>
      <TableCell className="w-[212px]">
        <Status item={item} />
      </TableCell>
      <TableCell className="w-14 text-right">
        {item.type === "TRANSFER_OUT" ? (
          <Button variant="link" size="sm" className="h-auto px-0" asChild>
            <Link href={detailHref(item)}>{t("tx.transferDetail")}</Link>
          </Button>
        ) : (
          <RowActions chain={item.chain} txHash={item.txHash} />
        )}
      </TableCell>
    </TableRow>
  );
}

export function TransferCard({ item }: { item: TransferHistoryItem }) {
  const { t, lang } = useLang();
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-text">{formatDateTime(item.createdAt, lang)}</span>
        <Status item={item} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <DirectionCell item={item} />
        <AmountCell amount={item.amount} />
      </div>
    </>
  );

  if (item.type === "TRANSFER_OUT") {
    return (
      <Link
        href={detailHref(item)}
        className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-control hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-focus-ring"
        data-testid="history-transfer-card"
      >
        {body}
        <span className="flex items-center justify-end gap-1 text-sm text-primary-text">
          {t("tx.transferDetail")}
          <ChevronRight className="size-4" />
        </span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4" data-testid="history-transfer-card">
      {body}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-text">{t("tx.txHash")}</span>
        <span className="flex items-center gap-1">
          <TxHashCell chain={item.chain} txHash={item.txHash} />
          <RowActions chain={item.chain} txHash={item.txHash} />
        </span>
      </div>
    </div>
  );
}
