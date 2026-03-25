"use client";

import { useMutation } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { mockCreateRedeem } from "@/lib/api/mock-api";
import { validateAmount } from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { EXCHANGE_RATE, MINTING_FEE_PERCENT } from "@/lib/constants";
import { getChainById } from "@/lib/chains";

export function useRedeem() {
  const store = useRedeemStore();

  const amountError = store.amount
    ? validateAmount(store.amount, "redeem")
    : null;

  const parsedAmount = parseAmount(store.amount);
  const receiveAmount = parsedAmount * EXCHANGE_RATE - parsedAmount * MINTING_FEE_PERCENT;
  const fee = parsedAmount * MINTING_FEE_PERCENT;
  const selectedChain = getChainById(store.chainId);

  const isFormValid =
    store.amount !== "" &&
    store.bankAccountId !== "" &&
    !amountError;

  const createRedeemMutation = useMutation({
    mutationFn: (walletAddress: string) =>
      mockCreateRedeem({
        chainId: store.chainId,
        amount: parsedAmount,
        bankAccountId: store.bankAccountId,
        walletAddress,
      }),
  });

  function goToReview() {
    if (isFormValid) store.setStep("review");
  }

  function goBackToForm() {
    store.setStep("form");
  }

  async function executeRedeem(walletAddress: string) {
    store.setStep("executing");
    await createRedeemMutation.mutateAsync(walletAddress);
    store.setStep("success");
  }

  return {
    ...store,
    amountError,
    parsedAmount,
    receiveAmount,
    fee,
    selectedChain,
    isFormValid,
    goToReview,
    goBackToForm,
    executeRedeem,
    isExecuting: createRedeemMutation.isPending,
    redeemOrder: createRedeemMutation.data,
  };
}
