"use client";

// Ringkasan Transaksi modal (USDX-243, hardened USDX-259, week3.md § Ringkasan
// Transaksi). The last screen before the order is created. The precondition gate
// (network = Polygon, USDX balance ≥ amount, POL gas warning) must pass before
// "Lanjut ke Konfirmasi" enables. Confirm calls POST /v2/redeem (sending the
// connected userAddress), then the hook navigates to the status tracker — which
// states the destination the ORDER answered with and asks the customer to agree to
// it before the burn can run (USDX-661). The names/numbers shown HERE are still the
// customer's own input: the order does not exist yet, so nothing on this screen is
// the bank's answer. Create errors (422 INVALID_BANK_ACCOUNT / INSUFFICIENT_BALANCE /
// WALLET_BLACKLISTED / VALIDATION_ERROR, 503 REDEEM_DISABLED) surface inline.
//
// The button used to read "Konfirmasi & Burn" while its handler only created the
// order — the burn moved to the tracker with USDX-661, so the label was promising an
// action it no longer performed. It now names the step it actually reaches: the
// destination confirmation (SELF_SIGN) or the PIN dialog (CUSTODIAL). The PIN dialog's
// own confirm button keeps "Konfirmasi & Burn", because there it is true.

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
import { PinConfirmDialog } from "@/components/shared/PinConfirmDialog";
import { PinNotSetNotice } from "@/components/shared/PinNotSetNotice";
import { StepUpNotices } from "@/components/shared/StepUpNotices";
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
    createErrorStatusKey,
    walletBlocked,
    isCustodialSource,
    pinOpen,
    setPinOpen,
    openPin,
    pinErrorKey,
    pinNotSet,
    pinCooldownSeconds,
    twoFactorErrorKey,
    twoFactorCooldownSeconds,
    twoFactorSetupRequired,
    outboundLockedUntil,
    // Custodial only (the hook reports none of these on the external source): 2FA
    // required + 24-hour lock (custodial-wallet.md §6.1, USDX-717) — same card/banner
    // as the form, and the PIN step is not opened while either holds.
    stepUpBlocked,
  } = useRedeem();

  const selectedChain = getChainById(REDEEM_CHAIN_ID);
  // Destination is two-path (USDX-267): the hook hands us the bank name + full
  // number + holder name for whichever path is active (saved entry or manual).
  // The owner sees their own number in full (un-mask 2026-06-25, USDX-270).

  function handleConfirm() {
    // Custodial (USDX-567): the PIN is the approval and travels with the create,
    // so this button opens the PIN dialog; the create fires from there.
    if (isCustodialSource) {
      openPin();
      return;
    }
    // On success the hook navigates to the tracker (this modal unmounts); on
    // failure the error is surfaced via `createErrorKey`, so swallow the reject.
    submitRedeem().catch(() => {});
  }

  function handlePin(pin: string, twoFactorCode: string) {
    // PIN and 2FA-code failures stay in the dialog (`pinErrorKey`,
    // `twoFactorErrorKey`); others close it and show in this summary via
    // `createErrorKey` (or the 2FA card / lock banner).
    submitRedeem(pin, twoFactorCode).catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("sum.title")}</DialogTitle>
        </DialogHeader>

        {/* Six rows, a fee block and up to three alerts: this is the tallest
            modal on the money path, so the body scrolls and the footer stays put
            instead of pushing the confirm button past the fold (finding A8). */}
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
              {isCustodialSource && (
                <span className="text-muted-text">{t("redeem.sourceCustodial")} ·</span>
              )}
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

          <Alert tone="info">
            {isCustodialSource ? t("redeem.custodialNote") : t("redeem.burnNote")}
          </Alert>

          {/* Custodial + no PIN on the account: nothing can be approved on this
              path (redeem.yaml 401 PIN_NOT_SET). The notice carries "Create PIN"
              and opens the set-PIN dialog right here (USDX-651); until then the
              PIN dialog that must fail is not opened. */}
          {isCustodialSource && pinNotSet && <PinNotSetNotice data-testid="redeem-pin-not-set" />}

          <StepUpNotices
            setupRequired={twoFactorSetupRequired}
            lockedUntil={outboundLockedUntil}
            action="redeem"
            testIdPrefix="redeem-review"
          />

          {/* Precondition gate (week3.md § Precondition connect-wallet, USDX-259):
              wrong network blocks with a switch prompt; insufficient USDX blocks;
              low POL is a non-blocking warning. On the custodial source the hook
              reports chainOk=true / lowGasWarning=false, so only the balance
              check can render here. */}
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

          {createErrorKey && (
            <Alert tone="danger" data-testid="redeem-create-error">
              {t(
                createErrorKey,
                createErrorStatusKey ? { status: t(createErrorStatusKey) } : undefined,
              )}
            </Alert>
          )}
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
            // WALLET_NOT_ACTIVE: no retry — the status does not change by pressing again.
            disabled={!canBurn || walletBlocked || (isCustodialSource && pinNotSet) || stepUpBlocked}
            loading={isCreating}
            loadingLabel={t("common.processing")}
          >
            {t("btn.continueToConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Custodial approval (USDX-567): the only place the user says yes — after
          this there is no wallet signature. Rendered inside the summary dialog
          so the figures stay behind it. */}
      {isCustodialSource && (
        <PinConfirmDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          description={t("redeem.pinDescription", { amount: formatAmount(amountUsdx) })}
          onSubmit={handlePin}
          isSubmitting={isCreating}
          errorKey={pinErrorKey}
          cooldownSeconds={pinCooldownSeconds}
          twoFactorErrorKey={twoFactorErrorKey}
          twoFactorCooldownSeconds={twoFactorCooldownSeconds}
          pinNotSet={pinNotSet}
          confirmLabel={t("btn.confirmBurn")}
        />
      )}
    </Dialog>
  );
}
