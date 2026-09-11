"use client";

// Redeem form logic (USDX-243, hardened USDX-259). Combines the redeem store + live
// sell rate (GET /v2/rate `effectiveSellRate`) + fee breakdown + validation + the
// contextual wallet connect & precondition gate (network/balance/gas) + the
// create-order mutation (POST /v2/redeem, sending the connected `userAddress`),
// then hands the created order to the status tracker and runs the guarded burn.
// The on-chain burn is real via wagmi when env.useMock is off (USDX-263); the
// mock layer simulates it offline (lib/redeem/burn.ts).

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { useConsumerRate } from "@/hooks/useConsumerRate";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useRedeemPreconditions } from "@/lib/redeem/wallet";
import { useRedeemBurn } from "@/hooks/useRedeemBurn";
import { createRedeemOrder } from "@/lib/api/redeem-api";
import { computeRedeemBreakdown } from "@/lib/redeem/fees";
import {
  validateAmount,
  validateBankAccountNumber,
  validateBankAccountName,
} from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { getBankName } from "@/lib/banks";
import {
  REDEEM_CHAIN_ID,
  REDEEM_FEE_PCT,
  DISBURSEMENT_FEE_FLAT_IDR,
  MIN_REDEEM_PAYOUT_IDR,
  MAX_REDEEM_AMOUNT,
} from "@/lib/constants";
import {
  isApiError,
  isValidationError,
  isRateLimited,
  isInsufficientBalance,
  isWalletBlacklisted,
  isInvalidBankAccount,
  isRedeemDisabled,
  isInvalidPin,
  isPinNotSet,
  isTooManyAttempts,
  isWalletNotActive,
  getRateLimitSeconds,
} from "@/lib/api/errors";

// Maps a create-order failure to an i18n key the review modal renders inline
// (week3.md § Endpoints Redeem error codes). PIN failures on the custodial path
// (401 INVALID_PIN / PIN_NOT_SET, 429 TOO_MANY_ATTEMPTS — redeem.yaml, USDX-565)
// are NOT mapped here: they belong in the PIN dialog (`pinErrorKey` below), so
// the user retypes where the mistake was made.
export function redeemErrorKey(error: unknown): string | null {
  if (!error) return null;
  // 429 RATE_LIMITED is surfaced globally as a toast (Providers query/mutation
  // cache, USDX-252) — suppress the inline modal error so it isn't a misleading
  // generic message, and let the user retry after the throttle clears.
  if (isRateLimited(error)) return null;
  if (isInvalidPin(error) || isPinNotSet(error) || isTooManyAttempts(error)) return null;
  if (isApiError(error)) {
    // Custodial wallet PROVISIONING/SUSPENDED — rejected before any order exists.
    // The status does not change by pressing again (wallet.yaml § 409).
    if (isWalletNotActive(error)) return "redeem.errWalletNotActive";
    // Wallet pre-check failures (USDX-259) — the precondition gate normally blocks
    // these before create, but surface the backend backstop inline too.
    if (isInsufficientBalance(error)) return "redeem.errInsufficientBalance";
    if (isWalletBlacklisted(error)) return "redeem.errWalletBlacklisted";
    if (isInvalidBankAccount(error)) return "redeem.errBankAccount";
    if (isValidationError(error)) return "redeem.errValidation";
    if (isRedeemDisabled(error)) return "redeem.errDisabled";
    if (error.status === 403) return "redeem.errGate"; // EMAIL/KYC/SUSPENDED gating
  }
  return "redeem.errGeneric";
}

export function useRedeem() {
  const store = useRedeemStore();
  const rateQuery = useConsumerRate();
  // Sumber burn (USDX-567, custodial-wallet.md §5.3): wallet custodial user
  // (sistem yang menandatangani setelah PIN) atau wallet eksternal ter-connect
  // (self-sign, jalur existing). Pilihan hanya ada untuk pemilik wallet ACTIVE;
  // selain itu `source` dipaksa `external` dan hook ini berperilaku persis
  // seperti sebelumnya.
  const custodial = useCustodialWallet();
  const custodialAvailable = custodial.isActive && !!custodial.address;
  const source = custodialAvailable ? store.source : "external";
  const isCustodialSource = source === "custodial";
  const pinCooldown = useCooldown();
  const [pinNotSet, setPinNotSet] = useState(false);

  const effectiveSellRate = rateQuery.data ? Number(rateQuery.data.effectiveSellRate) : null;
  const enteredAmount = parseAmount(store.amount);

  // Live fee breakdown for the form preview ("Anda akan terima" = net payout).
  // Mirrors the backend fee_configs; POST /v2/redeem stays authoritative.
  const breakdown = useMemo(
    () =>
      computeRedeemBreakdown({
        amount: enteredAmount,
        amountCurrency: store.amountCurrency,
        effectiveSellRate: effectiveSellRate ?? 0,
        redeemFeePct: REDEEM_FEE_PCT,
        disbursementFeeFlatIdr: DISBURSEMENT_FEE_FLAT_IDR,
      }),
    [enteredAmount, store.amountCurrency, effectiveSellRate],
  );

  // Wallet precondition gate against the burn amount (network/balance/gas) —
  // external wallet only. Always called (rules of hooks); ignored on the
  // custodial path, which has no network to switch and no gas to hold.
  const preconditions = useRedeemPreconditions(breakdown.amountUsdx);
  const { runBurn } = useRedeemBurn();

  // What burns and what it holds, per source. The custodial balance comes from
  // GET /api/v2/wallet (null = unknown, never 0); the external one from the
  // on-chain read. Shortfall is only asserted against a KNOWN balance.
  const burnAddress = isCustodialSource ? custodial.address : preconditions.address;
  const balanceUsdx = isCustodialSource ? custodial.balanceUsdx : preconditions.balanceUsdx;
  const insufficientBalance = isCustodialSource
    ? breakdown.amountUsdx > 0 && balanceUsdx != null && balanceUsdx < breakdown.amountUsdx
    : preconditions.insufficientBalance;
  const canBurn = isCustodialSource ? !insufficientBalance : preconditions.canBurn;

  // Validate the USDX amount against the redeem min/max. A USD input is itself
  // the USDX amount; an IDR input needs the rate to convert first (skip until loaded).
  const amountError = !store.amount
    ? null
    : store.amountCurrency === "USD"
      ? validateAmount(store.amount, "redeem")
      : effectiveSellRate
        ? validateAmount(String(breakdown.amountUsdx), "redeem")
        : null;

  const accountNumberError = store.bankAccountNumber
    ? validateBankAccountNumber(store.bankAccountNumber)
    : null;
  const accountNameError = store.bankAccountName
    ? validateBankAccountName(store.bankAccountName)
    : null;

  // Net payout must clear the minimum (week3.md § Min payout). Only meaningful
  // once an amount is entered and the rate has loaded.
  const belowMinPayout =
    enteredAmount > 0 &&
    effectiveSellRate != null &&
    breakdown.netPayoutIdr < MIN_REDEEM_PAYOUT_IDR;

  // Bank destination is two-path (USDX-267): a saved account needs only the picked
  // reference; manual entry needs the full, valid trio.
  const hasBankDestination = store.savedAccount
    ? true
    : store.bankCode !== "" &&
      store.bankAccountNumber !== "" &&
      store.bankAccountName !== "" &&
      !accountNumberError &&
      !accountNameError;

  const isFormValid =
    store.amount !== "" &&
    hasBankDestination &&
    !amountError &&
    effectiveSellRate != null &&
    breakdown.amountUsdx > 0 &&
    !belowMinPayout;

  // Unified destination for the read-only summary + Ringkasan. Both paths render the
  // full number + resolved bank name (un-mask 2026-06-25, USDX-270): saved path from
  // the picked entry, manual path from the typed fields (bank name resolved locally).
  const destination = store.savedAccount
    ? {
        bankCode: store.savedAccount.bankCode,
        bankName: store.savedAccount.bankName,
        accountNumber: store.savedAccount.accountNumber,
        accountName: store.savedAccount.accountName,
      }
    : {
        bankCode: store.bankCode,
        bankName: getBankName(store.bankCode),
        accountNumber: store.bankAccountNumber,
        accountName: store.bankAccountName,
      };

  const createMutation = useMutation({
    // `pin` only travels on the custodial path (redeem.yaml § CreateRedeemOrder.pin):
    // the backend ignores it on SELF_SIGN, and the FE does not send it there.
    mutationFn: (pin?: string) =>
      createRedeemOrder({
        amount: store.amount.trim(),
        amountCurrency: store.amountCurrency,
        chain: REDEEM_CHAIN_ID,
        // Custodial: the user's custodial address (backend derives burnMode from
        // it); external: the connected burn wallet (USDX-259).
        userAddress: burnAddress ?? "",
        ...(isCustodialSource && pin ? { pin } : {}),
        // Two-path bank destination (USDX-267): saved → only `bankAccountId` (the
        // backend resolves the number/name from the entry); manual → the trio.
        // Omitted fields drop from the JSON body.
        ...(store.savedAccount
          ? { bankAccountId: store.savedAccount.id }
          : {
              bankCode: store.bankCode,
              bankAccountNumber: store.bankAccountNumber.trim(),
              bankAccountName: store.bankAccountName.trim(),
            }),
      }),
    onError: (error) => {
      if (isPinNotSet(error)) setPinNotSet(true);
      if (isTooManyAttempts(error)) {
        pinCooldown.start(getRateLimitSeconds(error) || DEFAULT_COOLDOWN_SECONDS);
      }
      // Non-PIN failures show in the Ringkasan: close the PIN dialog so they are seen.
      if (!isInvalidPin(error) && !isPinNotSet(error) && !isTooManyAttempts(error)) {
        store.setPinOpen(false);
      }
    },
  });

  function toggleCurrency() {
    store.setAmountCurrency(store.amountCurrency === "USD" ? "IDR" : "USD");
  }

  // "Max" → redeem the full connected-wallet USDX balance (capped at the redeem
  // max). The amount field follows the active denomination: USD = USDX directly,
  // IDR = gross sale value (balance × sell rate, floored to whole rupiah).
  function setMaxAmount() {
    const balance = balanceUsdx;
    if (balance == null || balance <= 0) return;
    const maxUsdx = Math.min(balance, MAX_REDEEM_AMOUNT);
    if (store.amountCurrency === "USD") {
      store.setAmount(String(maxUsdx));
    } else if (effectiveSellRate) {
      store.setAmount(String(Math.floor(maxUsdx * effectiveSellRate)));
    }
  }

  // Create the order → navigate to the tracker → sign + broadcast the burn (with
  // the guard double-burn state machine). The burn is fired (not awaited) so the
  // modal closes as soon as the order exists; the tracker polls and reflects
  // AWAITING_BURN → … → PAYOUT_COMPLETE and the burn state.
  //
  // Custodial (`burnMode: CUSTODIAL` — decided by the BACKEND in the create
  // response, not by the FE): nothing to sign. The PIN sent with the create was
  // the approval; the system dispatches the burn and the tracker shows
  // "memproses burn" until the scanner confirms. `runBurn` also refuses a
  // CUSTODIAL order on its own, so a stale `source` can never trigger a wallet.
  async function submitRedeem(pin?: string) {
    const order = await createMutation.mutateAsync(pin);
    setPinNotSet(false);
    store.setOrderId(order.id);
    store.setStep("tracker");
    if (order.burnMode !== "CUSTODIAL") {
      void runBurn(order, preconditions.address ?? "");
    } else {
      custodial.invalidate(); // saldo turun begitu burn masuk blok
    }
    return order;
  }

  return {
    // form fields
    amount: store.amount,
    setAmount: store.setAmount,
    setMaxAmount,
    amountCurrency: store.amountCurrency,
    toggleCurrency,
    bankCode: store.bankCode,
    setBankCode: store.setBankCode,
    bankAccountNumber: store.bankAccountNumber,
    setBankAccountNumber: store.setBankAccountNumber,
    bankAccountName: store.bankAccountName,
    setBankAccountName: store.setBankAccountName,
    // saved-account (two-path) destination — USDX-267
    savedAccount: store.savedAccount,
    selectSavedAccount: store.selectSavedAccount,
    clearSavedAccount: store.clearSavedAccount,
    destination, // unified display: { bankCode, bankName, accountNumber, accountName }
    reset: store.reset,
    // rate
    effectiveSellRate,
    isRateLoading: rateQuery.isLoading,
    isRateError: rateQuery.isError,
    // derived breakdown: amountUsdx, grossIdr, redeemFeeIdr, disbursementFeeIdr,
    // totalFeeIdr, netPayoutIdr
    ...breakdown,
    // validation
    amountError,
    accountNumberError,
    accountNameError,
    belowMinPayout,
    isFormValid,
    // burn source (USDX-567): custodial wallet (PIN, system signs) or external
    // wallet (connect + self-sign). The switch only exists for custodial owners.
    source,
    setSource: store.setSource,
    custodialAvailable,
    isCustodialSource,
    custodialAddress: custodialAvailable ? custodial.address : null,
    custodialBalanceState: custodial.balanceState,
    // wallet + preconditions (contextual connect — redeem-only, no global button).
    // On the custodial path there is no wallet to connect, no network to switch
    // and no gas to warn about: the gate collapses to the balance check.
    isWalletConnected: isCustodialSource ? true : preconditions.isConnected,
    walletAddress: burnAddress,
    connectWallet: preconditions.connect,
    chainOk: isCustodialSource ? true : preconditions.chainOk,
    switchNetwork: preconditions.switchNetwork,
    isSwitchingNetwork: isCustodialSource ? false : preconditions.isSwitchingNetwork,
    balanceUsdx,
    insufficientBalance,
    lowGasWarning: isCustodialSource ? false : preconditions.lowGasWarning,
    canBurn,
    // PIN dialog (custodial path) — store-owned so a create success closes it.
    pinOpen: store.pinOpen,
    setPinOpen: store.setPinOpen,
    openPin: () => {
      createMutation.reset();
      store.setPinOpen(true);
    },
    pinErrorKey: isInvalidPin(createMutation.error)
      ? "pin.errInvalid"
      : isPinNotSet(createMutation.error)
        ? "pin.errNotSet"
        : null,
    pinNotSet: pinNotSet || custodial.pinSet === false,
    pinCooldownSeconds: pinCooldown.remaining,
    // submit (create order → tracker → guarded burn / system-dispatched burn)
    submitRedeem,
    isCreating: createMutation.isPending,
    createErrorKey: redeemErrorKey(createMutation.error),
    resetCreateError: createMutation.reset,
  };
}
