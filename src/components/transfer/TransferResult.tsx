"use client";

// Sesudah kirim (USDX-567 → tracker USDX-701). `202`/`200` adalah BUKTI BROADCAST,
// bukan konfirmasi: layar mulai di "Terkirim, menunggu konfirmasi" lalu memantau
// GET /api/v2/wallet/transfers/{id} memakai `result.id` sampai CONFIRMED/FAILED —
// tanpa reload. Replay `200` membawa id yang sama dengan `202`, dan store hanya
// memegang satu `result`, jadi retry tidak pernah membuka tracker kedua.
//
// Sebelum jawaban detail pertama tiba, panel dibangun dari `TransferAccepted` apa
// adanya dengan status PENDING (itulah arti 202). Poll berhenti di status final dan
// saat layar ditinggal (unmount).

import Link from "next/link";
import { History } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TransferStatusPanel } from "@/components/transfer/TransferStatusPanel";
import { useWalletTransferTracker } from "@/hooks/useWalletTransferTracker";
import { useLang } from "@/providers/LanguageProvider";
import { OUTGOING_HISTORY_HREF } from "@/lib/history-item";
import type { TransferAccepted, WalletTransfer } from "@/types";

interface TransferResultProps {
  result: TransferAccepted;
  onAgain: () => void;
}

function acceptedAsPending(result: TransferAccepted): WalletTransfer {
  return { ...result, status: "PENDING", failureReason: null, blockNumber: null, finalizedAt: null };
}

export function TransferResult({ result, onAgain }: TransferResultProps) {
  const { t } = useLang();
  const tracker = useWalletTransferTracker(result.id);
  const transfer = tracker.transfer ?? acceptedAsPending(result);

  // Galat pengecekan (jaringan, 5xx, 404 yang tak semestinya) tidak mengubah
  // status yang tampil — transfernya tetap sudah di-broadcast. Cukup dikatakan.
  const note = tracker.isError ? (
    <Alert tone="warning" shape="strip" data-testid="transfer-status-check-failed">
      {t("transfer.tracker.checkFailed")}
    </Alert>
  ) : null;

  return (
    // `contents`: pembungkus hanya memberi pegangan test, tidak ikut tata letak.
    <div className="contents" data-testid="transfer-result">
      <TransferStatusPanel transfer={transfer} note={note}>
        <div className="flex flex-col gap-2">
          <Button variant="brand" size="lg" onClick={onAgain}>
            {t("transfer.again")}
          </Button>
          <Button variant="outline" size="lg" asChild>
            {/* Bukan lagi "Riwayat transfer": riwayat = /history tab Keluar (§5.7, USDX-713). */}
            <Link href={OUTGOING_HISTORY_HREF}>
              <History />
              {t("transfer.detail.backToHistory")}
            </Link>
          </Button>
        </div>
      </TransferStatusPanel>
    </div>
  );
}
