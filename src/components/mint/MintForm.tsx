"use client";

import { useState } from "react";
import { ArrowUpDown, BookText, ScanLine } from "lucide-react";
import { useMint } from "@/hooks/useMint";
import { useKycGate } from "@/hooks/useKycGate";
import { formatAmount } from "@/lib/utils";
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
import { MintReview } from "@/components/mint/MintReview";
import { AddressBookPicker } from "@/components/mint/AddressBookPicker";
import { AddressScannerDialog } from "@/components/mint/AddressScannerDialog";
import { MintFormSkeleton } from "@/components/mint/MintFormSkeleton";
import { useLang } from "@/providers/LanguageProvider";

// The amount is a real `Input`, stripped of its own box because it already sits
// in one: the border and background belong to the AmountBox, the focus ring
// stays on the control. (Before this it was a bare `<input>` with `outline-none`
// — the field showed no keyboard focus at all, finding E2.)
const AMOUNT_INPUT_CLASS =
  "h-auto min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-0 text-right text-2xl font-semibold tracking-tight md:text-2xl dark:bg-transparent pointer-fine:hover:border-transparent";

// One amount row: a currency chip (logo + ticker) on the left, and either the
// editable input (when the user denominates in this currency) or the computed
// counter-value on the right. The whole box — label, chip and value — is what
// swaps top/bottom when the denomination is toggled.
function AmountBox({
  label,
  chip,
  isInput,
  value,
  onChange,
  computed,
  ariaLabel,
}: {
  label: string;
  chip: React.ReactNode;
  isInput: boolean;
  value: string;
  onChange: (value: string) => void;
  computed: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
      <p className="text-sm font-medium text-muted-text">{label}</p>
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
          <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {computed}
          </p>
        )}
      </div>
    </div>
  );
}

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
    isRateFetching,
    refetchRate,
    destinationAddress,
    setDestinationAddress,
    amountError,
    addressError,
    isFormValid,
    selectedChain,
    // Ringkasan visibility is store state, not component state: the
    // post-handoff reset has to be able to close it from outside React.
    reviewOpen,
    setReviewOpen,
  } = useMint();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const gate = useKycGate();

  // First rate read, nothing cached: show the card's shape rather than an empty
  // card (B12 — Mint had no loading state). `isLoading` is false on every later
  // refetch, so this is the first paint only; after that only derived values
  // wait. All hooks above have already run, so the early return is safe.
  if (isRateLoading && !effectiveBuyRate) return <MintFormSkeleton />;

  const onAmountChange = (value: string) => setAmount(value.replace(/[^0-9.]/g, ""));
  const usdxDisplay = isRateLoading && amount ? "…" : amountUsdx > 0 ? formatAmount(amountUsdx) : "0";
  const idrDisplay = isRateLoading && amount ? "…" : subtotalIdr > 0 ? formatAmount(subtotalIdr) : "0";

  // The hooks hand back i18n keys (validations.ts returns keys, not sentences —
  // finding D1); the sentence is made here, where the language is known.
  const amountErrorText = translateValidation(t, amountError);
  const addressErrorText = translateValidation(t, addressError);

  // Which currency the amount is denominated in. The denominated box is the
  // editable one and sits on top; its counter-value sits below.
  const isUsd = amountCurrency === "USD";

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

  // USDX box: the mint amount. Editable & labelled "mint" when denominating in
  // USDX; otherwise it's the "you will receive" counter-value.
  const usdxBox = (
    <AmountBox
      label={isUsd ? t("form.youWillMint") : t("form.youWillReceive")}
      chip={usdxChip}
      isInput={isUsd}
      value={amount}
      onChange={onAmountChange}
      computed={usdxDisplay}
      ariaLabel={isUsd ? t("form.youWillMint") : t("form.youWillReceive")}
    />
  );

  // IDR box: always "you will pay"; editable when denominating in IDR.
  const idrBox = (
    <AmountBox
      label={t("form.youWillPay")}
      chip={idrChip}
      isInput={!isUsd}
      value={amount}
      onChange={onAmountChange}
      computed={idrDisplay}
      ariaLabel={t("form.youWillPay")}
    />
  );

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("title.mint")}</h2>

      <div className="flex flex-col gap-4">
        {/* Amount boxes with center currency swap. Toggling the denomination
            swaps the whole boxes (label + logo + value) top/bottom — the
            editable box always sits on top, its counter-value below. */}
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

          {/* Swap which currency you denominate the amount in (USDX ↔ IDR) */}
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

        {/* Exchange rate (live). A failed load now carries the action it asks
            for — "Coba lagi" used to be a sentence with nothing to click (B8). */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-text">{t("form.exchangeRate")}</p>
          {isRateError ? (
            <Alert
              tone="danger"
              shape="strip"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchRate()}
                  loading={isRateFetching}
                  loadingLabel={t("common.processing")}
                >
                  {t("common.retry")}
                </Button>
              }
            >
              {t("mint.rateError")}
            </Alert>
          ) : (
            <p className="text-base font-medium tracking-tight text-foreground">
              1 USDX ≈ {effectiveBuyRate ? formatAmount(effectiveBuyRate) : "…"} IDR
            </p>
          )}
        </div>

        {/* Destination address — manual / pick from address book / scan (W3) */}
        <Field>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <FieldLabel htmlFor="mint-address">{t("form.toThisAddress")}</FieldLabel>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="-mr-3"
              onClick={() => setPickerOpen(true)}
            >
              {t("form.addAddressBook")}
            </Button>
          </div>
          <InputGroup>
            <InputGroupInput
              id="mint-address"
              placeholder={t("form.addressPh")}
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              aria-invalid={!!addressErrorText}
              aria-describedby="mint-address-error"
            />
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    size="icon"
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
          <FieldHelp id="mint-address" error={addressErrorText} />
        </Field>
      </div>

      {/* Non-VERIFIED stays clickable so the KYC gate dialog can explain why
          the action is locked (USDX-153); form validation only gates VERIFIED. */}
      <Button
        type="button"
        variant="brand"
        size="lg"
        disabled={gate.verified && !isFormValid}
        onClick={() => gate.guard(() => setReviewOpen(true))}
      >
        {t("btn.mint")}
      </Button>

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

      <AddressScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScanned={setDestinationAddress}
      />
    </div>
  );
}
