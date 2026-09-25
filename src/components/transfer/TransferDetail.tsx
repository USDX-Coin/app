"use client";

// Detail satu transfer (/send/history/[id], USDX-701, wallet.yaml § transfer-detail).
// "Kembali ke riwayat" → /history tab Keluar (custodial-wallet.md §5.7, USDX-713).
// Memakai tracker yang sama dengan layar sesudah kirim: transfer yang masih PENDING
// terus dipantau (≥ 3 s) sampai final, yang sudah final tidak di-poll lagi.
//
// `notFound` (404 WALLET_TRANSFER_NOT_FOUND, atau 422 untuk id yang bukan UUID) =
// tautan basi/salah — atau milik orang lain, yang kontrak jawab sama persis. Pesannya
// netral, bukan galat sistem, dengan jalan kembali ke riwayat.

import Link from "next/link";
import { ArrowLeft, SearchX, ServerCrash } from "lucide-react";
import { useWalletTransferTracker } from "@/hooks/useWalletTransferTracker";
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
import { TransferStatusPanel } from "@/components/transfer/TransferStatusPanel";
import { OUTGOING_HISTORY_HREF } from "@/lib/history-item";

function BackToHistory({ variant = "outline" }: { variant?: "outline" | "brand" }) {
  const { t } = useLang();
  return (
    <Button variant={variant} size="lg" asChild>
      <Link href={OUTGOING_HISTORY_HREF}>
        <ArrowLeft />
        {t("transfer.detail.backToHistory")}
      </Link>
    </Button>
  );
}

export function TransferDetail({ id }: { id: string }) {
  const { t } = useLang();
  const tracker = useWalletTransferTracker(id);

  if (tracker.notFound) {
    return (
      <Empty className="rounded-2xl border border-border" data-testid="transfer-detail-not-found">
        <EmptyHeader>
          <EmptyMedia kind="empty">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{t("transfer.detail.notFoundTitle")}</EmptyTitle>
          <EmptyDescription>{t("transfer.detail.notFoundDesc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BackToHistory variant="brand" />
        </EmptyContent>
      </Empty>
    );
  }

  if (tracker.transfer) {
    const note = tracker.isError ? (
      <Alert tone="warning" shape="strip" data-testid="transfer-status-check-failed">
        {t("transfer.tracker.checkFailed")}
      </Alert>
    ) : null;
    return (
      <div className="flex flex-1 items-start justify-center pt-4">
        <TransferStatusPanel transfer={tracker.transfer} note={note}>
          <BackToHistory />
        </TransferStatusPanel>
      </div>
    );
  }

  if (tracker.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          tone="danger"
          title={t("transfer.detail.title")}
          icon={<ServerCrash />}
          action={
            <Button variant="outline" size="sm" onClick={() => tracker.refetch()} loading={tracker.isFetching}>
              {t("common.retry")}
            </Button>
          }
          data-testid="transfer-detail-error"
        >
          {t("transfer.tracker.checkFailed")}
        </Alert>
        <div>
          <BackToHistory />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-start justify-center pt-4" data-testid="transfer-detail-loading">
      <Skeleton shape="block" className="h-96 w-full max-w-lg" />
    </div>
  );
}
