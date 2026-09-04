"use client";

// Ringkasan Transaksi modal (USDX-243, hardened USDX-259, week3.md § Ringkasan
// Transaksi). Final confirmation before the burn. The precondition gate
// (network = Polygon, USDX balance ≥ amount, POL gas warning) must pass before
// "Konfirmasi & Burn" enables. Confirm calls POST /v2/redeem (sending the
// connected userAddress), then the hook navigates to the status tracker and signs
// + broadcasts the burn (real on-chain via wagmi, USDX-263; simulated on the mock
// layer). Create errors (422 INVALID_BANK_ACCOUNT / INSUFFICIENT_BALANCE /
// WALLET_BLACKLISTED / VALIDATION_ERROR, 503 REDEEM_DISABLED) surface inline.

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
import { useRedeem } from "@/hooks/useRedeem";
import { formatAmount, formatIDR, truncateAddress } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { REDEEM_CHAIN_ID } from "@/lib/constants";
import { useLang } from "@/providers/LanguageProvider";

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
    destination,
    walletAddress,
    chainOk,
    switchNetwork,
    isSwitchingNetwork,
    insufficientBalance,
    lowGasWarning,
    canBurn,
    submitRedeem,
    isCreating,
    createErrorKey,
  } = useRedeem();

  const selectedChain = getChainById(REDEEM_CHAIN_ID);
  // Destination is two-path (USDX-267): the hook hands us the bank name + full
  // number + holder name for whichever path is active (saved entry or manual).
  // The owner sees their own number in full (un-mask 2026-06-25, USDX-270).

  function handleConfirm() {
    // On success the hook navigates to the tracker (this modal unmounts); on
    // failure the error is surfaced via `createErrorKey`, so swallow the reject.
    submitRedeem().catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("sum.title")}</DialogTitle>
        </DialogHeader>

        {/* Six rows, a fee block and up to three alerts: this is the tallest
            modal on the money path, so the body scrolls and the footer stays put
            instead of pushing "Konfirmasi & Burn" past the fold (finding A8). */}
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Row label={t("sum.youWillRedeem")}>
              <img src="/image/usdx-coin.svg" alt="" className="size-5 rounded-full" />
              {formatAmount(amountUsdx)} USDX
            </Row>
            <Row label={t("sum.network")}>
              {selectedChain && (
                <img src={selectedChain.icon} alt="" className="size-4 rounded-sm" />
              )}
              {selectedChain?.name}
            </Row>
            <Row label={t("sum.sourceWallet")}>
              {walletAddress ? truncateAddress(walletAddress) : "—"}
            </Row>
            <Row label={t("sum.bankDestination")}>{destination.bankName}</Row>
            <Row label={t("sum.accountName")}>
              {destination.accountName} · {destination.accountNumber}
            </Row>
            <Row label={t("sum.exchangeRate")}>
              1 USDX ≈ {effectiveSellRate ? formatAmount(effectiveSellRate) : "—"} IDR
            </Row>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Row label={t("redeem.grossIdr")}>{formatIDR(grossIdr)}</Row>
            <Row label={t("redeem.totalFee")}>− {formatIDR(totalFeeIdr)}</Row>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{t("redeem.netPayout")}</span>
              <span className="text-sm font-semibold text-foreground">
                {formatIDR(netPayoutIdr)}
              </span>
            </div>
          </div>

          <Alert tone="info">{t("redeem.burnNote")}</Alert>

          {/* Precondition gate (week3.md § Precondition connect-wallet, USDX-259):
              wrong network blocks with a switch prompt; insufficient USDX blocks;
              low POL is a non-blocking warning. */}
          {!chainOk && (
            <Alert
              tone="warning"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={switchNetwork}
                  loading={isSwitchingNetwork}
                  loadingLabel={t("redeem.switchingNetwork")}
                >
                  {t("redeem.switchNetwork")}
                </Button>
              }
            >
              {t("redeem.wrongNetwork")}
            </Alert>
          )}

          {chainOk && insufficientBalance && (
            <Alert tone="danger">{t("redeem.insufficientBalance")}</Alert>
          )}

          {chainOk && !insufficientBalance && lowGasWarning && (
            <Alert tone="warning">{t("redeem.lowGas")}</Alert>
          )}

          {createErrorKey && <Alert tone="danger">{t(createErrorKey)}</Alert>}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!canBurn}
            loading={isCreating}
            loadingLabel={t("common.processing")}
          >
            {t("btn.confirmBurn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
