"use client";

// Panel status satu transfer custodial (USDX-701) — dipakai tracker sesudah kirim
// (TransferResult) dan halaman detail (/send/history/[id]). Tiga wajah:
//
//   PENDING   — "Terkirim, menunggu konfirmasi" + tautan explorer. Juga untuk nilai
//               status yang belum dikenal FE (`transferStatusOf`) dan untuk PENDING
//               yang sudah lama: kontrak melarang menyimpulkan gagal dari umur.
//   CONFIRMED — "Transfer berhasil". Satu-satunya tempat kata itu muncul.
//   FAILED    — "Transfer gagal — USDX tidak berpindah, aman kirim ulang". Sebabnya
//               (REVERTED/DROPPED) hanya di baris keterangan teknis, dan hanya bila
//               nilainya dikenal.
//
// Judul diumumkan lewat `aria-live` supaya perpindahan status terdengar tanpa reload.

import { CircleCheck, CircleX, Copy, ExternalLink, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LinkInline } from "@/components/ui/link-inline";
import { TransferStatusBadge } from "@/components/transfer/TransferStatusBadge";
import { useLang } from "@/providers/LanguageProvider";
import { getChainById } from "@/lib/chains";
import { formatDateTime, formatTokenAmount, truncateAddress, cn } from "@/lib/utils";
import { transferFailureReasonOf, transferStatusOf } from "@/lib/wallet-transfer";
import type { WalletTransfer, WalletTransferStatus } from "@/types";

const FACE: Record<
  WalletTransferStatus,
  { icon: typeof Hourglass; tint: string; title: string; desc: string }
> = {
  PENDING: {
    icon: Hourglass,
    tint: "bg-info/12 text-info-text",
    title: "transfer.tracker.pendingTitle",
    desc: "transfer.tracker.pendingDesc",
  },
  CONFIRMED: {
    icon: CircleCheck,
    tint: "bg-success/12 text-success-text",
    title: "transfer.tracker.confirmedTitle",
    desc: "transfer.tracker.confirmedDesc",
  },
  FAILED: {
    icon: CircleX,
    tint: "bg-destructive/12 text-destructive-text",
    title: "transfer.tracker.failedTitle",
    desc: "transfer.tracker.failedDesc",
  },
};

interface TransferStatusPanelProps {
  transfer: WalletTransfer;
  /** Catatan kecil di bawah rincian (mis. "status belum bisa dicek"). */
  note?: React.ReactNode;
  /** Tombol/aksi di dasar panel. */
  children?: React.ReactNode;
}

export function TransferStatusPanel({ transfer, note, children }: TransferStatusPanelProps) {
  const { t, lang } = useLang();
  const status = transferStatusOf(transfer);
  const reason = transferFailureReasonOf(transfer);
  const face = FACE[status];
  const Icon = face.icon;
  const explorer = getChainById(transfer.chain)?.explorerUrl;

  function copyHash() {
    navigator.clipboard.writeText(transfer.txHash);
    toast.success(t("toast.copied"));
  }

  return (
    <div
      className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-card p-5"
      data-testid="transfer-status"
      data-status={status}
    >
      <div className="flex flex-col items-center gap-3 text-center" aria-live="polite">
        <span className={cn("flex size-12 items-center justify-center rounded-full", face.tint)}>
          <Icon className="size-5" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">{t(face.title)}</h2>
        <p className="text-sm leading-5 text-muted-text">{t(face.desc)}</p>
      </div>

      <dl className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm">
        <Row label={t("tx.status")}>
          <TransferStatusBadge transfer={transfer} />
        </Row>
        <Row label={t("tx.amount")}>
          <span className="font-medium tabular-nums text-foreground">
            {formatTokenAmount(transfer.amount, lang)} USDX
          </span>
        </Row>
        <Row label={t("sum.recipientAddress")}>
          <span className="font-medium text-foreground" title={transfer.to}>
            {truncateAddress(transfer.to, 6)}
          </span>
        </Row>
        <Row label={t("transfer.detail.submittedAt")}>
          <span className="text-foreground">{formatDateTime(transfer.submittedAt, lang)}</span>
        </Row>
        {transfer.finalizedAt && (
          <Row label={t("transfer.detail.finalizedAt")}>
            <span className="text-foreground">{formatDateTime(transfer.finalizedAt, lang)}</span>
          </Row>
        )}
        {reason && (
          <Row label={t("transfer.failure.label")}>
            <span className="text-right text-foreground" data-testid="transfer-failure-reason">
              {t(`transfer.failure.${reason}`)}
            </span>
          </Row>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <dt className="text-muted-text">{t("transfer.txHash")}</dt>
          <dd className="flex items-center gap-1">
            {explorer ? (
              <LinkInline
                href={`${explorer}/tx/${transfer.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-medium"
                aria-label={t("transfer.viewOnExplorer")}
              >
                {truncateAddress(transfer.txHash, 6)}
                <ExternalLink className="size-3.5" />
              </LinkInline>
            ) : (
              <span className="font-medium text-foreground">{truncateAddress(transfer.txHash, 6)}</span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copyHash}
              aria-label={t("transfer.copyHash")}
              className="text-muted-text"
            >
              <Copy />
            </Button>
          </dd>
        </div>
      </dl>

      {note}
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-text">{label}</dt>
      <dd className="flex min-w-0 justify-end">{children}</dd>
    </div>
  );
}
