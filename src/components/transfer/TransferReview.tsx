"use client";

// Ringkasan transfer custodial (USDX-567) — modal konfirmasi terakhir sebelum
// dialog PIN. Sengaja terpisah dari PIN: user membaca tujuan + jumlah dulu tanpa
// ditekan kolom PIN, lalu "Lanjut ke PIN" membuka persetujuannya. Error create
// yang BUKAN soal PIN (plafon, blacklist, saldo, wallet tidak aktif, 503) tampil
// di sini, di samping angka yang menghasilkannya — bukan sebagai toast.

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PinNotSetNotice } from "@/components/shared/PinNotSetNotice";
import { useLang } from "@/providers/LanguageProvider";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { CUSTODIAL_CHAIN_ID } from "@/lib/constants";
import type { useTransfer } from "@/hooks/useTransfer";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-text">{label}</span>
      <span className="flex items-center gap-1.5 text-right font-medium text-foreground">
        {children}
      </span>
    </div>
  );
}

interface TransferReviewProps {
  transfer: ReturnType<typeof useTransfer>;
}

export function TransferReview({ transfer }: TransferReviewProps) {
  const { t } = useLang();
  const chain = getChainById(CUSTODIAL_CHAIN_ID);
  const {
    reviewOpen,
    setReviewOpen,
    to,
    parsedAmount,
    walletAddress,
    openPin,
    isSubmitting,
    formErrorKey,
    formErrorVars,
    walletBlocked,
    pinNotSet,
  } = transfer;

  return (
    <Dialog open={reviewOpen} onOpenChange={(next) => !isSubmitting && setReviewOpen(next)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("sum.title")}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-3">
            <Row label={t("sum.youWillSend")}>
              <img src="/image/usdx-coin.svg" alt="" className="size-5 rounded-full" />
              {formatAmount(parsedAmount)} USDX
            </Row>
            <Row label={t("sum.network")}>
              {chain && <img src={chain.icon} alt="" className="size-4 rounded-sm" />}
              {chain?.name}
            </Row>
            <Row label={t("sum.sourceWallet")}>
              {t("transfer.myWallet")} · {walletAddress ? truncateAddress(walletAddress) : "—"}
            </Row>
            <Row label={t("sum.recipientAddress")}>
              <span className="break-all font-mono text-xs">{to}</span>
            </Row>
          </div>

          <Alert tone="warning">{t("transfer.note")}</Alert>

          {/* Akun tanpa PIN tidak bisa menyetujui apa pun di jalur ini (wallet.yaml
              401 PIN_NOT_SET → arahkan membuat PIN). Tombol Buat PIN membuka
              dialognya di sini juga, tanpa meninggalkan transfer (USDX-651);
              sampai PIN ada, dialog PIN yang pasti gagal tidak dibuka. */}
          {pinNotSet && <PinNotSetNotice data-testid="transfer-pin-not-set" />}

          {formErrorKey && (
            <Alert tone="danger" data-testid="transfer-error">
              {t(formErrorKey, formErrorVars)}
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setReviewOpen(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          {/* Dimatikan saat WALLET_NOT_ACTIVE: statusnya tidak berubah karena
              ditekan lagi (wallet.yaml § 409). */}
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={openPin}
            disabled={walletBlocked || pinNotSet}
            loading={isSubmitting}
            loadingLabel={t("common.processing")}
          >
            {t("transfer.continueToPin")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
