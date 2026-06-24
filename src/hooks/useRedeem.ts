"use client";

// Redeem form logic (USDX-243, hardened USDX-259). Combines the redeem store + live
// sell rate (GET /v2/rate `effectiveSellRate`) + fee breakdown + validation + the
// contextual wallet connect & precondition gate (network/balance/gas) + the
// create-order mutation (POST /v2/redeem, sending the connected `userAddress`),
// then hands the created order to the status tracker and runs the guarded burn.
// The on-chain burn is real via wagmi when env.useMock is off (USDX-263); the
// mock layer simulates it offline (lib/redeem/burn.ts).

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { useConsumerRate } from "@/hooks/useConsumerRate";
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
} from "@/lib/api/errors";

// Maps a create-order failure to an i18n key the review modal renders inline
// (week3.md § Endpoints Redeem error codes).
function redeemErrorKey(error: unknown): string | null {
  if (!error) return null;
  // 429 RATE_LIMITED is surfaced globally as a toast (Providers query/mutation
  // cache, USDX-252) — suppress the inline modal error so it isn't a misleading
  // generic message, and let the user retry after the throttle clears.
  if (isRateLimited(error)) return null;
  if (isApiError(error)) {
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

  // Wallet precondition gate against the burn amount (network/balance/gas).
  const preconditions = useRedeemPreconditions(breakdown.amountUsdx);
  const { runBurn } = useRedeemBurn();

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

  const isFormValid =
    store.amount !== "" &&
    store.bankCode !== "" &&
    store.bankAccountNumber !== "" &&
    store.bankAccountName !== "" &&
    !amountError &&
    !accountNumberError &&
    !accountNameError &&
    effectiveSellRate != null &&
    breakdown.amountUsdx > 0 &&
    !belowMinPayout;

  const createMutation = useMutation({
    mutationFn: () =>
      createRedeemOrder({
        amount: store.amount.trim(),
        amountCurrency: store.amountCurrency,
        chain: REDEEM_CHAIN_ID,
        userAddress: preconditions.address ?? "", // connected burn wallet (USDX-259)
        bankCode: store.bankCode,
        bankAccountNumber: store.bankAccountNumber.trim(),
        bankAccountName: store.bankAccountName.trim(),
      }),
  });

  function toggleCurrency() {
    store.setAmountCurrency(store.amountCurrency === "USD" ? "IDR" : "USD");
  }

  // "Max" → redeem the full connected-wallet USDX balance (capped at the redeem
  // max). The amount field follows the active denomination: USD = USDX directly,
  // IDR = gross sale value (balance × sell rate, floored to whole rupiah).
  function setMaxAmount() {
    const balance = preconditions.balanceUsdx;
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
  async function submitRedeem() {
    const order = await createMutation.mutateAsync();
    store.setOrderId(order.id);
    store.setStep("tracker");
    void runBurn(order, preconditions.address ?? "");
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
    // wallet + preconditions (contextual connect — redeem-only, no global button)
    isWalletConnected: preconditions.isConnected,
    walletAddress: preconditions.address,
    connectWallet: preconditions.connect,
    chainOk: preconditions.chainOk,
    switchNetwork: preconditions.switchNetwork,
    isSwitchingNetwork: preconditions.isSwitchingNetwork,
    balanceUsdx: preconditions.balanceUsdx,
    insufficientBalance: preconditions.insufficientBalance,
    lowGasWarning: preconditions.lowGasWarning,
    canBurn: preconditions.canBurn,
    // submit (create order → tracker → guarded burn)
    submitRedeem,
    isCreating: createMutation.isPending,
    createErrorKey: redeemErrorKey(createMutation.error),
    resetCreateError: createMutation.reset,
  };
}
