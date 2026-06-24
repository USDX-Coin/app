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
import { getChainById } from "@/lib/chains";
import { getBankByCode } from "@/lib/banks";
import { REDEEM_CHAIN_ID } from "@/lib/constants";
import { useLang } from "@/providers/LanguageProvider";
import { KycGateDialog } from "@/components/kyc/KycGateDialog";
import { BankSelect } from "./BankSelect";
import { BankAccountPicker } from "./BankAccountPicker";
import { RedeemReview } from "./RedeemReview";

const AMOUNT_INPUT_CLASS =
  "min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground";

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
    <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {isInput && onMax && (
          <button
            type="button"
            onClick={onMax}
            className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            {maxLabel}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {chip}
        {isInput ? (
          <input
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
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
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

  const onAccountNumberChange = (value: string) => setBankAccountNumber(value.replace(/[^0-9]/g, ""));
  const onAmountChange = (value: string) => setAmount(value.replace(/[^0-9.]/g, ""));
  const usdxDisplay = isRateLoading && amount ? "…" : amountUsdx > 0 ? formatAmount(amountUsdx) : "0";
  const idrDisplay = isRateLoading && amount ? "…" : grossIdr > 0 ? formatAmount(grossIdr) : "0";
  const isUsd = amountCurrency === "USD";
  const showBreakdown = amount !== "" && effectiveSellRate != null && amountUsdx > 0;
  // Max fills the amount from the connected wallet's USDX balance (USDX-249).
  const canMax = isWalletConnected && balanceUsdx != null && balanceUsdx > 0;
  const onMax = canMax ? setMaxAmount : undefined;

  // Contextual connect: the first click opens the wallet connect (no global
  // button); once connected the button becomes "Redeem" and opens the Ringkasan.
  function handleRedeem() {
    if (!isWalletConnected) connectWallet();
    else setReviewOpen(true);
  }

  const usdxChip = (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-white">
      <span className="relative inline-block size-8 shrink-0">
        <img src="/image/usdx-logo.png" alt="" className="size-8 rounded-full" />
        {selectedChain && (
          <img
            src={selectedChain.icon}
            alt=""
            className="absolute -bottom-0.5 -right-0.5 size-[14px] rounded-full border border-primary bg-card"
          />
        )}
      </span>
      <span className="text-base font-semibold tracking-tight">USDX</span>
    </div>
  );

  const idrChip = (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-white">
      <span className="flex size-8 items-center justify-center rounded-full bg-gold text-sm font-semibold text-[#1a1a1a]">
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
    <div className="flex w-full max-w-[500px] flex-col gap-6 rounded-xl border border-border bg-card p-5">
      {/* Title + contextual wallet control (USDX-249): a Connect button to the
          right of the title until the user connects; once connected it shows the
          address + live USDX balance. Balance is only read AFTER connect (the
          on-chain read is gated on isConnected) — no global connect button. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-medium tracking-tight text-foreground">{t("title.redeem")}</h2>
        {!isWalletConnected ? (
          <button
            type="button"
            onClick={connectWallet}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Wallet className="size-4" />
            {t("redeem.connectWallet")}
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm">
            <Wallet className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {walletAddress ? truncateAddress(walletAddress) : "—"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold text-foreground">
              {balanceUsdx != null ? `${formatAmount(balanceUsdx)} USDX` : "…"}
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

          <button
            type="button"
            onClick={toggleCurrency}
            aria-label={t("form.swapCurrency")}
            className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowUpDown className="size-5" />
          </button>
        </div>

        {amountError && <p className="-mt-2 text-sm text-destructive">{amountError}</p>}

        {/* Exchange rate (live sell rate) */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">{t("form.exchangeRate")}</p>
          {isRateError ? (
            <p className="text-sm text-destructive">{t("mint.rateError")}</p>
          ) : (
            <p className="text-base font-medium tracking-tight text-foreground">
              1 USDX ≈ {effectiveSellRate ? formatAmount(effectiveSellRate) : "…"} IDR
            </p>
          )}
        </div>

        {/* Destination bank (USDX-261/267) — saved bank-account book or manual entry.
            Picking a saved account sends only `bankAccountId`: we show a read-only
            summary (bank + masked number + name) and never ask for the number again.
            "Change" clears the reference and returns to manual entry. */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{t("form.toThisBank")}</p>
            <button
              type="button"
              onClick={() => setBankPickerOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-gold underline-offset-2 hover:underline"
            >
              <BookText className="size-4" />
              {t("bankbook.choose")}
            </button>
          </div>

          {savedAccount ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
                <Landmark className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {getBankByCode(savedAccount.bankCode)?.name ?? savedAccount.bankCode}
                  </span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {t("bankbook.savedBadge")}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {savedAccount.accountNumberMasked} · {savedAccount.accountName}
                </span>
              </div>
              <button
                type="button"
                onClick={clearSavedAccount}
                className="shrink-0 text-sm font-medium text-gold underline-offset-2 hover:underline"
              >
                {t("bankbook.change")}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("form.bank")}</span>
                <BankSelect value={bankCode} onSelect={setBankCode} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("modal.accountNumber")}</span>
                <input
                  inputMode="numeric"
                  placeholder={t("modal.accountNumberPh")}
                  value={bankAccountNumber}
                  onChange={(e) => onAccountNumberChange(e.target.value)}
                  aria-label={t("modal.accountNumber")}
                  className="rounded-md bg-muted p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {accountNumberError && <p className="text-sm text-destructive">{accountNumberError}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("modal.holderName")}</span>
                <input
                  placeholder={t("modal.holderNamePh")}
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  aria-label={t("modal.holderName")}
                  className="rounded-md bg-muted p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {accountNameError && <p className="text-sm text-destructive">{accountNameError}</p>}
              </div>
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
            {belowMinPayout && <p className="text-sm text-destructive">{t("redeem.minPayout")}</p>}
          </div>
        )}
      </div>

      {/* SoT: the CTA is always "Redeem" — clicking opens the contextual wallet
          connect (when needed) then the Ringkasan (week3.md § Form Redeem).
          Non-VERIFIED stays clickable so the KYC gate dialog can explain the lock
          (USDX-153); form validation only gates VERIFIED users. */}
      <button
        type="button"
        disabled={gate.verified && !isFormValid}
        onClick={() => gate.guard(handleRedeem)}
        className="brand-gradient flex h-[42px] items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {t("btn.redeem")}
      </button>

      <KycGateDialog
        open={gate.open}
        onOpenChange={gate.setOpen}
        status={gate.status}
        rejectionReason={gate.rejectionReason}
      />

      <BankAccountPicker
        open={bankPickerOpen}
        onOpenChange={setBankPickerOpen}
        onApply={selectSavedAccount}
      />

      <RedeemReview open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}
