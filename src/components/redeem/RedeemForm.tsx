"use client";

// Redeem form (USDX-243). Amount (USD/IDR toggle, preview via GET /v2/rate
// `effectiveSellRate`) + inline bank destination (bank + account number + holder
// name) + fee breakdown ("Anda akan terima" = net payout). The "Redeem" button
// opens a contextual wallet connect (RainbowKit — no global button) when needed,
// then the Ringkasan modal. KYC gate intercepts non-VERIFIED users (USDX-153).

import { useState } from "react";
import { ArrowUpDown, BookText, Landmark, Wallet } from "lucide-react";
import { useRedeem } from "@/hooks/useRedeem";
import { useKycGate } from "@/hooks/useKycGate";
import { formatAmount, formatIDR, truncateAddress } from "@/lib/utils";
import { translateValidation } from "@/lib/validations";
import { getChainById } from "@/lib/chains";
import { REDEEM_CHAIN_ID } from "@/lib/constants";
import { useLang } from "@/providers/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KycGateDialog } from "@/components/kyc/KycGateDialog";
import { BankSelect } from "./BankSelect";
import { BankAccountPicker, type BankFill } from "./BankAccountPicker";
import { RedeemReview } from "./RedeemReview";

// The amount is a real `Input` with its own box stripped off — the border and
// background belong to the AmountBox around it, the focus ring stays on the
// control. The bare `<input outline-none>` it replaces showed no keyboard focus
// at all (finding E2).
// Ring fokus sengaja BUKAN di input ini, melainkan di kotak pembungkusnya —
// kontrol `flex-1` di dalam kotak berisi menggambar persegi kedua yang melayang
// di tengah yang pertama, dan itu terbaca sebagai cacat render, bukan sebagai
// fokus. Lihat komentar yang sama di `mint/MintForm.tsx`.
const AMOUNT_INPUT_CLASS =
  "h-auto min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-0 text-right text-2xl font-semibold tracking-tight shadow-none ring-0 outline-none focus-visible:border-0 focus-visible:ring-0 md:text-2xl dark:bg-transparent pointer-fine:hover:border-transparent";

// One amount row: a currency chip on the left, and either the editable input
// (when the user denominates in this currency) or the computed counter-value.
function AmountBox({
  label,
  chip,
  isInput,
  value,
  onChange,
  computed,
  ariaLabel,
  onMax,
  maxLabel,
}: {
  label: string;
  chip: React.ReactNode;
  isInput: boolean;
  value: string;
  onChange: (value: string) => void;
  computed: string;
  ariaLabel: string;
  onMax?: () => void;
  maxLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted p-4 transition-control has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-text">{label}</p>
        {isInput && onMax && (
          <Button type="button" variant="ghost" size="sm" onClick={onMax}>
            {maxLabel}
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {chip}
        {isInput ? (
          <Input
            inputMode="decimal"
            placeholder="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={AMOUNT_INPUT_CLASS}
            aria-label={ariaLabel}
          />
        ) : (
          <p className="truncate text-2xl font-semibold tracking-tight text-foreground">{computed}</p>
        )}
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={strong ? "font-medium text-foreground" : "text-muted-text"}>{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}

export function RedeemForm() {
  const { t } = useLang();
  const {
    amount,
    setAmount,
    setMaxAmount,
    amountCurrency,
    toggleCurrency,
    bankCode,
    setBankCode,
    bankAccountNumber,
    setBankAccountNumber,
    bankAccountName,
    setBankAccountName,
    savedAccount,
    selectSavedAccount,
    clearSavedAccount,
    amountUsdx,
    grossIdr,
    redeemFeeIdr,
    disbursementFeeIdr,
    netPayoutIdr,
    effectiveSellRate,
    isRateLoading,
    isRateError,
    amountError,
    accountNumberError,
    accountNameError,
    belowMinPayout,
    isFormValid,
    isWalletConnected,
    walletAddress,
    connectWallet,
    balanceUsdx,
  } = useRedeem();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const gate = useKycGate();
  const selectedChain = getChainById(REDEEM_CHAIN_ID);

  // Apply a picked bank account (USDX-267). An existing saved entry → saved path
  // (bankAccountId + read-only summary; the number is resolved server-side from the
  // entry). A just-added entry → manual path: auto-fill the editable fields with the
  // plaintext the user just typed (week3.md § Bank Account Book "auto-isi bank + nomor + nama").
  function applyBankFill(fill: BankFill) {
    if (fill.mode === "saved") {
      selectSavedAccount(fill.account);
    } else {
      clearSavedAccount();
      setBankCode(fill.bankCode);
      setBankAccountNumber(fill.accountNumber);
      setBankAccountName(fill.accountName);
    }
  }

  const onAccountNumberChange = (value: string) => setBankAccountNumber(value.replace(/[^0-9]/g, ""));
  const onAmountChange = (value: string) => setAmount(value.replace(/[^0-9.]/g, ""));
  const usdxDisplay = isRateLoading && amount ? "…" : amountUsdx > 0 ? formatAmount(amountUsdx) : "0";
  const idrDisplay = isRateLoading && amount ? "…" : grossIdr > 0 ? formatAmount(grossIdr) : "0";
  const isUsd = amountCurrency === "USD";
  const showBreakdown = amount !== "" && effectiveSellRate != null && amountUsdx > 0;
  // Max fills the amount from the connected wallet's USDX balance (USDX-249).
  const canMax = isWalletConnected && balanceUsdx != null && balanceUsdx > 0;
  const onMax = canMax ? setMaxAmount : undefined;

  // `useRedeem` passes the validators' i18n keys straight through (validations.ts
  // returns keys, not sentences — finding D1); they become sentences here.
  const amountErrorText = translateValidation(t, amountError);
  const accountNumberErrorText = translateValidation(t, accountNumberError);
  const accountNameErrorText = translateValidation(t, accountNameError);

  // Contextual connect: the first click opens the wallet connect (no global
  // button); once connected the button becomes "Redeem" and opens the Ringkasan.
  function handleRedeem() {
    if (!isWalletConnected) connectWallet();
    else setReviewOpen(true);
  }

  const usdxChip = (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-primary-foreground">
      <span className="relative inline-block size-8 shrink-0">
        <img src="/image/usdx-coin.svg" alt="" className="size-8 rounded-full" />
        {selectedChain && (
          <img
            src={selectedChain.icon}
            alt=""
            className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border border-primary bg-card"
          />
        )}
      </span>
      <span className="text-base font-semibold tracking-tight">USDX</span>
    </div>
  );

  const idrChip = (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-primary-foreground">
      <span className="flex size-8 items-center justify-center rounded-full bg-gold text-sm font-semibold text-on-gold">
        Rp
      </span>
      <span className="text-base font-semibold tracking-tight">IDR</span>
    </div>
  );

  // USDX box: the amount being redeemed (burned). Editable when denominating in USDX.
  const usdxBox = (
    <AmountBox
      label={t("form.youWillRedeem")}
      chip={usdxChip}
      isInput={isUsd}
      value={amount}
      onChange={onAmountChange}
      computed={usdxDisplay}
      ariaLabel={t("form.youWillRedeem")}
      onMax={onMax}
      maxLabel={t("common.max")}
    />
  );

  // IDR box: the gross sale value (before fee). Editable when denominating in IDR.
  const idrBox = (
    <AmountBox
      label={t("redeem.grossIdr")}
      chip={idrChip}
      isInput={!isUsd}
      value={amount}
      onChange={onAmountChange}
      computed={idrDisplay}
      ariaLabel={t("redeem.grossIdr")}
      onMax={onMax}
      maxLabel={t("common.max")}
    />
  );

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-border bg-card p-5">
      {/* Title + contextual wallet control (USDX-249): a Connect button to the
          right of the title until the user connects; once connected it shows the
          address + live USDX balance. Balance is only read AFTER connect (the
          on-chain read is gated on isConnected) — no global connect button. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!isWalletConnected ? (
          <Button type="button" variant="outline" onClick={connectWallet}>
            <Wallet />
            {t("redeem.connectWallet")}
          </Button>
        ) : (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm">
            <Wallet className="size-4 text-muted-text" />
            <span className="font-medium text-foreground">
              {walletAddress ? truncateAddress(walletAddress) : "—"}
            </span>
            <span className="text-muted-text">·</span>
            {/* Labelled for screen readers; an unknown balance shows "—", not a
                number and not an endless ellipsis (USDX-396). */}
            <span className="sr-only">{t("redeem.balanceLabel")}</span>
            <span className="font-semibold text-foreground">
              {balanceUsdx != null ? `${formatAmount(balanceUsdx)} USDX` : "—"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* Amount boxes with center currency swap (USDX ↔ gross IDR). */}
        <div className="relative flex flex-col gap-2">
          {isUsd ? (
            <>
              {usdxBox}
              {idrBox}
            </>
          ) : (
            <>
              {idrBox}
              {usdxBox}
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleCurrency}
                aria-label={t("form.swapCurrency")}
                className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full"
              >
                <ArrowUpDown className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("form.swapCurrency")}</TooltipContent>
          </Tooltip>
        </div>

        {amountErrorText && (
          <p role="alert" className="-mt-2 text-sm leading-5 text-destructive-text">
            {amountErrorText}
          </p>
        )}

        {/* Exchange rate (live sell rate) */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-text">{t("form.exchangeRate")}</p>
          {isRateError ? (
            <p role="alert" className="text-sm leading-5 text-destructive-text">{t("mint.rateError")}</p>
          ) : (
            <p className="text-base font-medium tracking-tight text-foreground">
              1 USDX ≈ {effectiveSellRate ? formatAmount(effectiveSellRate) : "…"} IDR
            </p>
          )}
        </div>

        {/* Destination bank (USDX-261/267) — saved bank-account book or manual entry.
            Picking a saved account sends only `bankAccountId`: we show a read-only
            summary (bank name + full number + holder) and never ask for the number again.
            "Change" clears the reference and returns to manual entry. */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-text">{t("form.toThisBank")}</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="-mr-3"
              onClick={() => setBankPickerOpen(true)}
            >
              <BookText />
              {t("bankbook.choose")}
            </Button>
          </div>

          {savedAccount ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-text">
                <Landmark className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {savedAccount.bankName}
                  </span>
                  <Badge tone="neutral">{t("bankbook.savedBadge")}</Badge>
                </span>
                <span className="truncate text-xs text-muted-text">
                  {savedAccount.accountNumber} · {savedAccount.accountName}
                </span>
              </div>
              <Button type="button" variant="link" size="sm" className="-mr-3" onClick={clearSavedAccount}>
                {t("bankbook.change")}
              </Button>
            </div>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="redeem-bank">{t("form.bank")}</FieldLabel>
                <BankSelect id="redeem-bank" value={bankCode} onSelect={setBankCode} />
              </Field>
              <Field>
                <FieldLabel htmlFor="redeem-account-number">{t("modal.accountNumber")}</FieldLabel>
                <Input
                  id="redeem-account-number"
                  inputMode="numeric"
                  placeholder={t("modal.accountNumberPh")}
                  value={bankAccountNumber}
                  onChange={(e) => onAccountNumberChange(e.target.value)}
                  aria-invalid={!!accountNumberErrorText}
                  aria-describedby="redeem-account-number-error"
                />
                <FieldHelp id="redeem-account-number" error={accountNumberErrorText} />
              </Field>
              <Field>
                <FieldLabel htmlFor="redeem-account-name">{t("modal.holderName")}</FieldLabel>
                <Input
                  id="redeem-account-name"
                  placeholder={t("modal.holderNamePh")}
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  aria-invalid={!!accountNameErrorText}
                  aria-describedby="redeem-account-name-error"
                />
                <FieldHelp id="redeem-account-name" error={accountNameErrorText} />
              </Field>
            </>
          )}
        </div>

        {/* Fee breakdown → net payout ("Anda akan terima") */}
        {showBreakdown && (
          <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
            <BreakdownRow label={t("redeem.grossIdr")} value={formatIDR(grossIdr)} />
            <BreakdownRow label={t("redeem.redeemFee")} value={`− ${formatIDR(redeemFeeIdr)}`} />
            <BreakdownRow label={t("redeem.disbursementFee")} value={`− ${formatIDR(disbursementFeeIdr)}`} />
            <div className="my-1 border-t border-border" />
            <BreakdownRow label={t("redeem.netPayout")} value={formatIDR(netPayoutIdr)} strong />
            {belowMinPayout && (
              <p role="alert" className="text-sm leading-5 text-destructive-text">{t("redeem.minPayout")}</p>
            )}
          </div>
        )}
      </div>

      {/* SoT: the CTA is always "Redeem" — clicking opens the contextual wallet
          connect (when needed) then the Ringkasan (week3.md § Form Redeem).
          Non-VERIFIED stays clickable so the KYC gate dialog can explain the lock
          (USDX-153); form validation only gates VERIFIED users. */}
      <Button
        type="button"
        variant="brand"
        size="lg"
        disabled={gate.verified && !isFormValid}
        onClick={() => gate.guard(handleRedeem)}
      >
        {t("btn.redeem")}
      </Button>

      <KycGateDialog
        open={gate.open}
        onOpenChange={gate.setOpen}
        status={gate.status}
        rejectionReason={gate.rejectionReason}
      />

      <BankAccountPicker
        open={bankPickerOpen}
        onOpenChange={setBankPickerOpen}
        onApply={applyBankFill}
      />

      <RedeemReview open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}
