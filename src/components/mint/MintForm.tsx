"use client";

import { useState } from "react";
import { ArrowUpDown, BookText, ScanLine } from "lucide-react";
import { useMint } from "@/hooks/useMint";
import { useKycGate } from "@/hooks/useKycGate";
import { formatAmount } from "@/lib/utils";
import { KycGateDialog } from "@/components/kyc/KycGateDialog";
import { MintReview } from "@/components/mint/MintReview";
import { AddressBookPicker } from "@/components/mint/AddressBookPicker";
import { useLang } from "@/providers/LanguageProvider";

const AMOUNT_INPUT_CLASS =
  "min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground";

export function MintForm() {
  const { t } = useLang();
  const {
    amount,
    setAmount,
    amountCurrency,
    toggleCurrency,
    amountUsdx,
    subtotalIdr,
    effectiveBuyRate,
    isRateLoading,
    isRateError,
    destinationAddress,
    setDestinationAddress,
    amountError,
    addressError,
    isFormValid,
    selectedChain,
  } = useMint();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const gate = useKycGate();

  const onAmountChange = (value: string) => setAmount(value.replace(/[^0-9.]/g, ""));
  const usdxDisplay = isRateLoading && amount ? "…" : amountUsdx > 0 ? formatAmount(amountUsdx) : "0";
  const idrDisplay = isRateLoading && amount ? "…" : subtotalIdr > 0 ? formatAmount(subtotalIdr) : "0";

  return (
    <div className="flex w-full max-w-[500px] flex-col gap-6 rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-medium tracking-tight text-foreground">{t("title.mint")}</h2>

      <div className="flex flex-col gap-4">
        {/* Amount boxes with center currency swap (USD/IDR toggle) */}
        <div className="relative flex flex-col gap-2">
          {/* You will mint — USDX */}
          <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium text-muted-foreground">{t("form.youWillMint")}</p>
            <div className="flex items-center justify-between gap-2">
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
              {amountCurrency === "USD" ? (
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  className={AMOUNT_INPUT_CLASS}
                  aria-label={t("form.youWillMint")}
                />
              ) : (
                <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
                  {usdxDisplay}
                </p>
              )}
            </div>
          </div>

          {/* You will pay — IDR (subtotal, before fee) */}
          <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium text-muted-foreground">{t("form.youWillPay")}</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-white">
                <span className="flex size-8 items-center justify-center rounded-full bg-gold text-sm font-semibold text-[#1a1a1a]">
                  Rp
                </span>
                <span className="text-base font-semibold tracking-tight">IDR</span>
              </div>
              {amountCurrency === "IDR" ? (
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  className={AMOUNT_INPUT_CLASS}
                  aria-label={t("form.youWillPay")}
                />
              ) : (
                <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
                  {idrDisplay}
                </p>
              )}
            </div>
          </div>

          {/* Swap which currency you enter the amount in (USD ↔ IDR) */}
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

        {/* Exchange rate (live) */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">{t("form.exchangeRate")}</p>
          {isRateError ? (
            <p className="text-sm text-destructive">{t("mint.rateError")}</p>
          ) : (
            <p className="text-base font-medium tracking-tight text-foreground">
              1 USDX ≈ {effectiveBuyRate ? formatAmount(effectiveBuyRate) : "…"} IDR
            </p>
          )}
        </div>

        {/* Destination address — manual / pick from address book / scan (W3) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <p className="text-muted-foreground">{t("form.toThisAddress")}</p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-gold underline-offset-2 hover:underline"
            >
              {t("form.addAddressBook")}
            </button>
          </div>
          <div className="flex items-center gap-2.5 rounded-md bg-muted p-3">
            <input
              placeholder={t("form.selectDestination")}
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              aria-label={t("form.toThisAddress")}
            />
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={t("addrbook.pickTitle")}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookText className="size-4 shrink-0" />
            </button>
            {/* QR scan lands with the Add Wallet modal in USDX-203 */}
            <ScanLine
              className="size-4 shrink-0 text-muted-foreground/50"
              aria-label={t("addrbook.scanSoon")}
            />
          </div>
          {addressError && <p className="text-sm text-destructive">{addressError}</p>}
        </div>
      </div>

      {/* Non-VERIFIED stays clickable so the KYC gate dialog can explain why
          the action is locked (USDX-153); form validation only gates VERIFIED. */}
      <button
        type="button"
        disabled={gate.verified && !isFormValid}
        onClick={() => gate.guard(() => setReviewOpen(true))}
        className="brand-gradient flex h-[42px] items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {t("btn.mint")}
      </button>

      <KycGateDialog
        open={gate.open}
        onOpenChange={gate.setOpen}
        status={gate.status}
        rejectionReason={gate.rejectionReason}
      />

      <MintReview open={reviewOpen} onOpenChange={setReviewOpen} />

      <AddressBookPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={setDestinationAddress}
      />
    </div>
  );
}
