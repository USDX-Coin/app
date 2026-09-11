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
// in one: the border, the background AND the focus ring all belong to the
// AmountBox. The ring is deliberately NOT on the input — an `flex-1` control
// inside a filled box draws a second rectangle floating in the middle of the
// first, which reads as a rendering fault rather than as focus. The box owns it
// via `has-[:focus-visible]`, so keyboard focus is still visible (finding E2)
// but it outlines the thing a person actually perceives as the field.
const AMOUNT_INPUT_CLASS =
  "h-auto min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-0 text-right text-2xl font-semibold tracking-tight shadow-none ring-0 outline-none focus-visible:border-0 focus-visible:ring-0 md:text-2xl dark:bg-transparent pointer-fine:hover:border-transparent";

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
  disabled,
}: {
  label: string;
  chip: React.ReactNode;
  isInput: boolean;
  value: string;
  onChange: (value: string) => void;
  computed: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted p-4 transition-control has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card">
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
            disabled={disabled}
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
    amountErrorVars,
    addressError,
    isFormValid,
    isMintUnavailable,
    isConfigReady,
    isConfigLoading,
    isConfigFetching,
    refetchConfig,
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
  // Whole rupiah, like every other rupiah figure in this flow (`formatIDR` in the
  // Ringkasan). Without it a swapped amount reads "19,000.01": the USDX side is
  // held to six decimals, so multiplying back leaves a fraction of a rupiah that
  // is not a real part of the price — and on this screen it would read as the
  // amount having moved.
  const idrDisplay =
    isRateLoading && amount ? "…" : subtotalIdr > 0 ? formatAmount(Math.round(subtotalIdr)) : "0";

  // The hooks hand back i18n keys (validations.ts returns keys, not sentences —
  // finding D1); the sentence is made here, where the language is known.
  // The mint minimum is a rupiah figure from GET /api/v2/config, so the number
  // in the message travels with the error rather than living in the dictionary.
  const amountErrorText = translateValidation(t, amountError, amountErrorVars);
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
      disabled={isMintUnavailable}
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
      disabled={isMintUnavailable}
    />
  );

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-border bg-card p-5">
      {/* Minting is closed for this user (USDX-640). The notice is the FIRST
          thing in the card on purpose: the point is that nobody types a figure,
          reads the fees and reaches the summary before finding out. The fields
          below are disabled for the same reason — a form that still takes input
          reads as "keep going".

          It says maintenance and nothing more. The real reason is that minting
          is open to a list of testers while the test bundle runs, and that is
          our business, not a distinction an ordinary user should have to make
          about where their money is going. */}
      {isMintUnavailable && (
        <Alert tone="warning" title={t("mint.maintenanceTitle")}>
          {t("mint.maintenanceNotice")}
        </Alert>
      )}

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
                disabled={isMintUnavailable}
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
              disabled={isMintUnavailable}
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
              disabled={isMintUnavailable}
              aria-invalid={!!addressErrorText}
              aria-describedby="mint-address-error"
            />
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    size="icon"
                    disabled={isMintUnavailable}
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
                    disabled={isMintUnavailable}
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

      {/* The minimum and the fees are backend-owned (USDX-635/638). Until they
          land there is no honest amount to validate against and no fee to show,
          so Mint is off and says why — rather than falling back to a guessed
          bound that would silently reject a perfectly valid Rp 20.000. */}
      {!isConfigReady && !isMintUnavailable && (
        <Alert
          tone={isConfigLoading ? "info" : "danger"}
          shape="strip"
          action={
            isConfigLoading ? undefined : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchConfig()}
                loading={isConfigFetching}
                loadingLabel={t("common.processing")}
              >
                {t("common.retry")}
              </Button>
            )
          }
        >
          {isConfigLoading ? t("mint.configLoading") : t("mint.configError")}
        </Alert>
      )}

      {/* Non-VERIFIED stays clickable so the KYC gate dialog can explain why
          the action is locked (USDX-153); form validation only gates VERIFIED. */}
      <Button
        type="button"
        variant="brand"
        size="lg"
        // Closed for everyone while minting is unavailable — including the
        // non-VERIFIED path, which otherwise opens the KYC dialog and invites
        // someone to finish KYC for an action they still could not take.
        disabled={isMintUnavailable || (gate.verified && !isFormValid)}
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
