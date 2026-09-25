"use client";

// Form transfer dari wallet custodial (USDX-567, custodial-wallet.md §5.1).
// Sumbernya selalu "wallet custodial saya" — tidak ada connect wallet dan tidak
// ada gas yang dipikirkan user. Tujuan: ketik / buku alamat / pindai QR (komponen
// mint dipakai ulang). Jumlah dalam USDX saja: transfer memindahkan token, tidak
// ada konversi IDR. CTA "Kirim" → Ringkasan → PIN → hasil.
//
// Saldo dibaca dari GET /api/v2/wallet lewat useCustodialWallet; "—" saat tidak
// terbaca, tidak pernah 0 palsu. Wallet PROVISIONING/SUSPENDED → form dimatikan
// dan alasannya dikatakan di atas (409 WALLET_NOT_ACTIVE tidak berubah karena
// ditekan lagi).
//
// 2FA (custodial-wallet.md §6.1, USDX-717) juga dikatakan DULUAN: akun tanpa 2FA
// mendapat kartu ajakan aktivasi (dialognya terbuka di tempat, USDX-714) dan uang
// keluar yang sedang ditahan 24 jam mendapat banner "ditahan sampai …" — keduanya
// mematikan tombol Kirim sampai keadaannya berubah, tanpa reload.

import { useState } from "react";
import { BookText, ScanLine, Wallet } from "lucide-react";
import { useKycGate } from "@/hooks/useKycGate";
import { useTransfer } from "@/hooks/useTransfer";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { translateValidation } from "@/lib/validations";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KycGateDialog } from "@/components/kyc/KycGateDialog";
import { AddressBookPicker } from "@/components/mint/AddressBookPicker";
import { AddressScannerDialog } from "@/components/mint/AddressScannerDialog";
import { PinConfirmDialog } from "@/components/shared/PinConfirmDialog";
import { TwoFactorSetupNotice } from "@/components/shared/TwoFactorSetupNotice";
import { OutboundLockNotice } from "@/components/shared/OutboundLockNotice";
import { TransferReview } from "@/components/transfer/TransferReview";
import { TransferResult } from "@/components/transfer/TransferResult";
import { useLang } from "@/providers/LanguageProvider";

// Sama dengan MintForm/RedeemForm: kotak yang memegang border + ring, input polos.
const AMOUNT_INPUT_CLASS =
  "h-auto min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-0 text-right text-2xl font-semibold tracking-tight shadow-none ring-0 outline-none focus-visible:border-0 focus-visible:ring-0 md:text-2xl dark:bg-transparent pointer-fine:hover:border-transparent";

export function TransferForm() {
  const { t, lang } = useLang();
  const transfer = useTransfer(t, lang);
  const {
    step,
    result,
    reset,
    walletAddress,
    walletStatus,
    isWalletActive,
    balanceUsdx,
    balanceState,
    to,
    setTo,
    amount,
    setAmount,
    setMaxAmount,
    addressError,
    amountError,
    isFormValid,
    setReviewOpen,
    pinOpen,
    setPinOpen,
    submitWithPin,
    isSubmitting,
    pinErrorKey,
    pinNotSet,
    pinCooldownSeconds,
    twoFactorErrorKey,
    twoFactorCooldownSeconds,
    twoFactorSetupRequired,
    outboundLockedUntil,
    parsedAmount,
  } = transfer;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const gate = useKycGate();

  if (step === "done" && result) {
    return <TransferResult result={result} onAgain={reset} />;
  }

  const onAmountChange = (value: string) => setAmount(value.replace(/[^0-9.]/g, ""));
  const addressErrorText = translateValidation(t, addressError);
  const amountErrorText = translateValidation(t, amountError);
  const canMax = balanceState === "ready" && balanceUsdx != null && balanceUsdx > 0;

  const balanceText =
    balanceState === "ready" && balanceUsdx != null
      ? `${formatAmount(balanceUsdx)} USDX`
      : balanceState === "loading"
        ? t("balance.loading")
        : "—";

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-border bg-card p-5">
      {/* Wallet belum bisa mengirim — dikatakan DULUAN, sebelum user mengetik. */}
      {!isWalletActive && (
        <Alert tone="warning" title={t("transfer.walletNotActiveTitle")} data-testid="transfer-wallet-blocked">
          {walletStatus === "SUSPENDED"
            ? t("transfer.walletSuspended")
            : t("transfer.walletProvisioning")}
        </Alert>
      )}

      {isWalletActive && twoFactorSetupRequired && (
        <TwoFactorSetupNotice
          data-testid="transfer-2fa-required"
          messageKey="stepUp.setupRequiredSend"
          tone="warning"
        />
      )}
      {isWalletActive && (
        <OutboundLockNotice data-testid="transfer-locked" lockedUntil={outboundLockedUntil} />
      )}

      {/* Sumber: wallet custodial saya + saldo. Bukan tombol connect — tidak ada
          wallet eksternal di jalur ini. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Wallet className="size-4 shrink-0 text-muted-text" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs text-muted-text">{t("transfer.from")}</span>
            <span className="truncate font-medium text-foreground">
              {t("transfer.myWallet")}
              {walletAddress ? ` · ${truncateAddress(walletAddress)}` : ""}
            </span>
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-xs text-muted-text">{t("transfer.balance")}</span>
          <span className="font-semibold text-foreground" data-testid="transfer-balance" aria-live="polite">
            {balanceText}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Jumlah — USDX saja. */}
        <div className="flex flex-col gap-4 rounded-xl bg-muted p-4 transition-control has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-text">{t("form.youWillSend")}</p>
            {canMax && (
              <Button type="button" variant="ghost" size="sm" onClick={setMaxAmount} disabled={!isWalletActive}>
                {t("common.max")}
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-primary-foreground">
              <img src="/image/usdx-coin.svg" alt="" className="size-8 rounded-full" />
              <span className="text-base font-semibold tracking-tight">USDX</span>
            </div>
            <Input
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className={AMOUNT_INPUT_CLASS}
              aria-label={t("form.youWillSend")}
              disabled={!isWalletActive}
            />
          </div>
        </div>

        {amountErrorText && (
          <p role="alert" className="-mt-2 text-sm leading-5 text-destructive-text">
            {amountErrorText}
          </p>
        )}

        {/* Tujuan — ketik / buku alamat / pindai QR (komponen mint dipakai ulang). */}
        <Field>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <FieldLabel htmlFor="transfer-address">{t("form.toThisAddress")}</FieldLabel>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="-mr-3"
              disabled={!isWalletActive}
              onClick={() => setPickerOpen(true)}
            >
              {t("form.addAddressBook")}
            </Button>
          </div>
          <InputGroup>
            <InputGroupInput
              id="transfer-address"
              placeholder={t("form.addressPh")}
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              disabled={!isWalletActive}
              aria-invalid={!!addressErrorText}
              aria-describedby="transfer-address-error"
            />
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    size="icon"
                    disabled={!isWalletActive}
                    onClick={() => setPickerOpen(true)}
                    aria-label={t("addrbook.pickTitle")}
                  >
                    <BookText />
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>{t("addrbook.pickTitle")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    size="icon"
                    disabled={!isWalletActive}
                    onClick={() => setScanOpen(true)}
                    aria-label={t("scan.open")}
                  >
                    <ScanLine />
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>{t("scan.open")}</TooltipContent>
              </Tooltip>
            </InputGroupAddon>
          </InputGroup>
          <FieldHelp id="transfer-address" error={addressErrorText} />
        </Field>
      </div>

      {/* Non-VERIFIED tetap bisa diklik supaya dialog gate KYC menjelaskan
          kuncinya (USDX-153); validasi form hanya menahan user VERIFIED. */}
      <Button
        type="button"
        variant="brand"
        size="lg"
        disabled={
          !isWalletActive ||
          twoFactorSetupRequired ||
          outboundLockedUntil !== null ||
          (gate.verified && !isFormValid)
        }
        onClick={() => gate.guard(() => setReviewOpen(true))}
      >
        {t("btn.send")}
      </Button>

      <KycGateDialog
        open={gate.open}
        onOpenChange={gate.setOpen}
        status={gate.status}
        rejectionReason={gate.rejectionReason}
      />

      <TransferReview transfer={transfer} />

      <PinConfirmDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        description={t("transfer.pinDescription", {
          amount: formatAmount(parsedAmount),
          to: truncateAddress(to, 6),
        })}
        onSubmit={(pin, code) => void submitWithPin(pin, code)}
        isSubmitting={isSubmitting}
        errorKey={pinErrorKey}
        cooldownSeconds={pinCooldownSeconds}
        twoFactorErrorKey={twoFactorErrorKey}
        twoFactorCooldownSeconds={twoFactorCooldownSeconds}
        pinNotSet={pinNotSet}
        confirmLabel={t("btn.send")}
      />

      <AddressBookPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={setTo} />

      <AddressScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScanned={setTo} />
    </div>
  );
}
