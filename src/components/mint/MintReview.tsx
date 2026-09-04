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

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMint } from "@/hooks/useMint";
import { formatAmount, formatIDR, truncateAddress } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
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
    amountUsdx,
    subtotalIdr,
    effectiveBuyRate,
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
      <DialogContent className="sm:max-w-[460px]">
        <DialogTitle className="text-base font-medium text-foreground">{t("sum.title")}</DialogTitle>

        <div className="mt-2 flex flex-col gap-3">
          <Row label={t("sum.mintAmount")}>
            <img src="/image/usdx-coin.svg" alt="" className="size-5 rounded-full" />
            {formatAmount(amountUsdx)} USDX
          </Row>
          <Row label={t("sum.network")}>
            {selectedChain && <img src={selectedChain.icon} alt="" className="size-4 rounded-sm" />}
            {selectedChain?.name}
          </Row>
          <Row label={t("sum.recipientAddress")}>{truncateAddress(destinationAddress)}</Row>
          <Row label={t("sum.exchangeRate")}>
            1 USDX ≈ {effectiveBuyRate ? formatAmount(effectiveBuyRate) : "—"} IDR
          </Row>
        </div>

        <div className="mt-1 flex flex-col gap-1 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t("sum.totalPayment")}</span>
            <span className="text-sm font-semibold text-foreground">≈ {formatIDR(subtotalIdr)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("sum.feeNote")}</p>
        </div>

        <div className="mt-2 rounded-lg bg-[#eef4fb] p-3 text-sm text-foreground dark:bg-[#13243d]">
          <span className="font-semibold">{t("confirm.note")}</span> {t("confirm.noteBody")}
        </div>

        {createErrorKey && (
          <p role="alert" className="text-sm text-destructive">
            {t(createErrorKey)}
          </p>
        )}

        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleProceed}
            disabled={isSubmitting}
            className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? t("common.processing") : t("btn.proceedPayment")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
