"use client";

// Hasil transfer custodial (USDX-567). Yang ditampilkan adalah BUKTI BROADCAST:
// tx hash + tautan explorer, bukan klaim "berhasil" — konfirmasi on-chain terjadi
// setelah 202 dan belum ada endpoint pemantaunya (USDX-577). Riwayat transfer
// juga belum ada kontraknya (USDX-576), jadi layar ini satu-satunya tempat user
// melihat hash-nya; ada tombol salin.

import { Copy, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LinkInline } from "@/components/ui/link-inline";
import { useLang } from "@/providers/LanguageProvider";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import type { TransferAccepted } from "@/types";

interface TransferResultProps {
  result: TransferAccepted;
  onAgain: () => void;
}

export function TransferResult({ result, onAgain }: TransferResultProps) {
  const { t } = useLang();
  const explorer = getChainById(result.chain)?.explorerUrl;

  function copyHash() {
    navigator.clipboard.writeText(result.txHash);
    toast.success(t("toast.copied"));
  }

  return (
    <div
      className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-card p-5"
      data-testid="transfer-result"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-info/12 text-info-text">
          <Send className="size-5" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">{t("transfer.sentTitle")}</h2>
        <p className="text-sm leading-5 text-muted-text">{t("transfer.sentDesc")}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-text">{t("sum.youWillSend")}</span>
          <span className="font-medium text-foreground">{formatAmount(Number(result.amount))} USDX</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-text">{t("sum.recipientAddress")}</span>
          <span className="font-medium text-foreground">{truncateAddress(result.to, 6)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <span className="text-muted-text">{t("transfer.txHash")}</span>
          <span className="flex items-center gap-1">
            {explorer ? (
              <LinkInline
                href={`${explorer}/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-medium"
                aria-label={t("transfer.viewOnExplorer")}
              >
                {truncateAddress(result.txHash, 6)}
                <ExternalLink className="size-3.5" />
              </LinkInline>
            ) : (
              <span className="font-medium text-foreground">{truncateAddress(result.txHash, 6)}</span>
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
          </span>
        </div>
      </div>

      <Alert tone="info" shape="strip">
        {t("transfer.sentDesc")}
      </Alert>

      <Button variant="brand" size="lg" onClick={onAgain}>
        {t("transfer.again")}
      </Button>
    </div>
  );
}
