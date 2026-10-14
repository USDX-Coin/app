"use client";

// Ringkasan Transaksi modal (USDX-201, week2.md § Halaman Checkout & Ringkasan #2).
// Final confirmation before the order is created. "Lanjut Pembayaran" calls
// POST /v2/mint (create) then the hook hands off (cross-origin) to the checkout
// repo at mint.usdx.co.id (USDX-225). Create errors (422 RECIPIENT_BLACKLISTED /
// VALIDATION_ERROR, 503 MINT_DISABLED) surface inline.
//
// Confirm is gated on `isSubmitting` = creating OR handing off, not on
// `isCreating` alone: the mutation settles back to idle while the cross-origin
// navigation is still in flight, and a second click in that gap buys the same mint
// twice. The gate is store-backed, so it survives closing and reopening the modal.

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
import { useMint } from "@/hooks/useMint";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { formatRateIDR } from "@/components/mint/MintRatesPopover";
import { useLang } from "@/providers/LanguageProvider";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-text">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-foreground">{children}</span>
    </div>
  );
}

interface MintReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MintReview({ open, onOpenChange }: MintReviewProps) {
  const { t } = useLang();
  const {
    selectedChain,
    destinationAddress,
    isCustodialDestination,
    amountUsdx,
    conversionRate,
    gatewayBuyRate,
    offersBniTransfer,
    isMintDisabled,
    submitMint,
    isSubmitting,
    createErrorKey,
  } = useMint();

  function handleProceed() {
    // On success the hook redirects to checkout; on failure the error is
    // surfaced via `createErrorKey`, so swallow the rejection here.
    submitMint().catch(() => {});
  }

  // Escape / outside-click must not dismiss the modal mid-handoff — the order is
  // already created and the page is leaving; let the redirect finish.
  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("sum.title")}</DialogTitle>
        </DialogHeader>

        {/* The body is the only scrolling part: on a 320×568 phone the rows plus
            the note are taller than the panel, and header + footer stay pinned so
            "Lanjut Pembayaran" never slides off the bottom (finding A8). */}
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Row label={t("sum.mintAmount")}>
              <img src="/image/logo-coin.png" alt="" className="size-5 rounded-full" />
              {formatAmount(amountUsdx)} USDX
            </Row>
            <Row label={t("sum.network")}>
              {selectedChain && (
                <img src={selectedChain.icon} alt="" className="size-4 rounded-sm" />
              )}
              {selectedChain?.name}
            </Row>
            {/* "Ke wallet custodial saya" is the FE matching the order's address
                against the user's custodial address byte for byte (custodial-
                wallet.md §5.2) — there is no flag on the order. */}
            <Row label={t("sum.recipientAddress")}>
              {isCustodialDestination && (
                <span className="text-muted-text" data-testid="mint-review-custodial">
                  {t("mint.destCustodial")} ·
                </span>
              )}
              {truncateAddress(destinationAddress)}
            </Row>
            {/* Kurs beli per metode yang DITAWARKAN — sama dengan "Lihat kurs" di
                form (keputusan Wisnu 13 Okt 2026). Transfer BNI TANPA angka
                (keputusan PM 14 Okt 2026, USDX-749): rupiah nasabah dipotong
                dengan kurs BNI di wondr yang tidak kita ketahui. Metode yang tidak
                ditawarkan tidak tampil. Tanpa biaya/total: itu dikunci di /pay dan
                tampil di checkout (§4.3.4). Backend lama tanpa kurs per metode →
                tetap satu baris "Nilai tukar". */}
            {!offersBniTransfer && gatewayBuyRate == null ? (
              <Row label={t("sum.exchangeRate")}>
                1 USDX ≈ {conversionRate != null ? formatRateIDR(conversionRate) : "—"}
              </Row>
            ) : (
              <>
                {gatewayBuyRate != null && (
                  <Row label={t("mint.rateVa")}>
                    <span data-testid="mint-review-rate-va">1 USDX = {formatRateIDR(gatewayBuyRate)}</span>
                  </Row>
                )}
                {offersBniTransfer && (
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="shrink-0 text-muted-text">{t("mint.rateBni")}</span>
                    <span
                      className="text-right font-medium text-foreground"
                      data-testid="mint-review-rate-bni"
                    >
                      {t("mint.rateBniNote")}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <Alert tone="info" title={t("confirm.note")}>
            {t("confirm.noteBody")}
          </Alert>

          {/* A failed create keeps the dialog open and keeps the message next to
              the numbers that produced it — a toast would take it away. */}
          {createErrorKey && <Alert tone="danger">{t(createErrorKey)}</Alert>}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={handleProceed}
            // 503 MINT_DISABLED re-read the config to an empty method list:
            // a second create would get the same 503.
            disabled={isMintDisabled && !isSubmitting}
            loading={isSubmitting}
            loadingLabel={t("common.processing")}
          >
            {t("btn.proceedPayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
