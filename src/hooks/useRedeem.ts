"use client";

// Redeem form logic (USDX-243). Combines the redeem store + live sell rate
// (GET /v2/rate `effectiveSellRate`) + fee breakdown + validation + the
// contextual wallet connect + the create-order mutation (POST /v2/redeem), then
// hands the created order to the status tracker. The on-chain burn is simulated
// in W3 (lib/redeem/burn.ts); real burn + real API land in INT-1 (USDX-249).

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { useConsumerRate } from "@/hooks/useConsumerRate";
import { useRedeemWallet } from "@/lib/redeem/wallet";
import { createRedeemOrder } from "@/lib/api/redeem-api";
import { signAndBroadcastBurn } from "@/lib/redeem/burn";
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
} from "@/lib/constants";
import { isApiError, isValidationError } from "@/lib/api/errors";

// Maps a create-order failure to an i18n key the review modal renders inline
// (week3.md § Endpoints Redeem error codes).
function redeemErrorKey(error: unknown): string | null {
  if (!error) return null;
  if (isApiError(error)) {
    if (error.code === "INVALID_BANK_ACCOUNT") return "redeem.errBankAccount";
    if (isValidationError(error)) return "redeem.errValidation";
    if (error.code === "REDEEM_DISABLED") return "redeem.errDisabled";
    if (error.status === 403) return "redeem.errGate"; // EMAIL/KYC/SUSPENDED gating
  }
  return "redeem.errGeneric";
}

export function useRedeem() {
  const store = useRedeemStore();
  const rateQuery = useConsumerRate();
  const wallet = useRedeemWallet();

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
        bankCode: store.bankCode,
        bankAccountNumber: store.bankAccountNumber.trim(),
        bankAccountName: store.bankAccountName.trim(),
      }),
  });

  function toggleCurrency() {
    store.setAmountCurrency(store.amountCurrency === "USD" ? "IDR" : "USD");
  }

  // Create the order → navigate to the tracker → sign + broadcast the burn.
  // The burn is fired (not awaited) so the modal closes as soon as the order
  // exists; the tracker polls and reflects AWAITING_BURN → … → PAYOUT_COMPLETE.
  async function submitRedeem() {
    const order = await createMutation.mutateAsync();
    store.setOrderId(order.id);
    store.setStep("tracker");
    void signAndBroadcastBurn(order, wallet.address ?? "").catch(() => {});
    return order;
  }

  return {
    // form fields
    amount: store.amount,
    setAmount: store.setAmount,
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
    // wallet (contextual connect — redeem-only, no global button)
    isWalletConnected: wallet.isConnected,
    walletAddress: wallet.address,
    connectWallet: wallet.connect,
    // submit (create order → tracker → simulated burn)
    submitRedeem,
    isCreating: createMutation.isPending,
    createErrorKey: redeemErrorKey(createMutation.error),
    resetCreateError: createMutation.reset,
  };
}
