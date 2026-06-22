"use client";

// Ringkasan Transaksi modal (USDX-243, week3.md § Ringkasan Transaksi). Final
// confirmation before the burn. "Konfirmasi & Burn" calls POST /v2/redeem
// (create), then the hook navigates to the status tracker and signs +
// broadcasts the burn (simulated in W3; real on-chain burn = INT-1). Create
// errors (422 INVALID_BANK_ACCOUNT / VALIDATION_ERROR, 503 REDEEM_DISABLED)
// surface inline.

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRedeem } from "@/hooks/useRedeem";
import { formatAmount, formatIDR, truncateAddress } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { getBankByCode } from "@/lib/banks";
import { REDEEM_CHAIN_ID } from "@/lib/constants";
import { useLang } from "@/providers/LanguageProvider";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

interface RedeemReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RedeemReview({ open, onOpenChange }: RedeemReviewProps) {
  const { t } = useLang();
  const {
    amountUsdx,
    grossIdr,
    totalFeeIdr,
    netPayoutIdr,
    effectiveSellRate,
    bankCode,
    bankAccountNumber,
    bankAccountName,
    walletAddress,
    submitRedeem,
    isCreating,
    createErrorKey,
  } = useRedeem();

  const selectedChain = getChainById(REDEEM_CHAIN_ID);
  const bank = getBankByCode(bankCode);
  const maskedAccount = "••••" + bankAccountNumber.slice(-4);

  function handleConfirm() {
    // On success the hook navigates to the tracker (this modal unmounts); on
    // failure the error is surfaced via `createErrorKey`, so swallow the reject.
    submitRedeem().catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogTitle className="text-base font-medium text-foreground">{t("sum.title")}</DialogTitle>

        <div className="mt-2 flex flex-col gap-3">
          <Row label={t("sum.youWillRedeem")}>
            <img src="/image/usdx-logo.png" alt="" className="size-5 rounded-full" />
            {formatAmount(amountUsdx)} USDX
          </Row>
          <Row label={t("sum.network")}>
            {selectedChain && <img src={selectedChain.icon} alt="" className="size-4 rounded-sm" />}
            {selectedChain?.name}
          </Row>
          <Row label={t("sum.sourceWallet")}>{walletAddress ? truncateAddress(walletAddress) : "—"}</Row>
          <Row label={t("sum.bankDestination")}>{bank?.name ?? bankCode}</Row>
          <Row label={t("sum.accountName")}>
            {bankAccountName} · {maskedAccount}
          </Row>
          <Row label={t("sum.exchangeRate")}>
            1 USDX ≈ {effectiveSellRate ? formatAmount(effectiveSellRate) : "—"} IDR
          </Row>
        </div>

        <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
          <Row label={t("redeem.grossIdr")}>{formatIDR(grossIdr)}</Row>
          <Row label={t("redeem.totalFee")}>− {formatIDR(totalFeeIdr)}</Row>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t("redeem.netPayout")}</span>
            <span className="text-sm font-semibold text-foreground">{formatIDR(netPayoutIdr)}</span>
          </div>
        </div>

        <div className="mt-2 rounded-lg bg-[#eef4fb] p-3 text-sm text-foreground dark:bg-[#13243d]">
          {t("redeem.burnNote")}
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
            disabled={isCreating}
            className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCreating}
            className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {isCreating ? t("common.processing") : t("btn.confirmBurn")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
