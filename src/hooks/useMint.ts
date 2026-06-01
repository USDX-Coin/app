"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMintStore } from "@/stores/mintStore";
import { mockCreateMint } from "@/lib/api/mock-api";
import { validateAmount, validateAddress } from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { MINTING_FEE_PERCENT, USD_TO_IDR_RATE } from "@/lib/constants";
import { getChainById } from "@/lib/chains";

export function useMint() {
  const store = useMintStore();
  const queryClient = useQueryClient();

  const amountError = store.amount ? validateAmount(store.amount, "mint") : null;
  const addressError = store.destinationAddress
    ? validateAddress(store.destinationAddress)
    : null;

  const parsedAmount = parseAmount(store.amount);
  // Mint USDX, pay in IDR (per Figma).
  const paymentAmountIdr = parsedAmount * USD_TO_IDR_RATE;
  const fee = parsedAmount * MINTING_FEE_PERCENT;
  const receiveAmount = parsedAmount;
  const selectedChain = useMemo(() => getChainById(store.chainId), [store.chainId]);

  const isFormValid =
    store.amount !== "" &&
    store.destinationAddress !== "" &&
    !amountError &&
    !addressError;

  const createMintMutation = useMutation({
    mutationFn: () =>
      mockCreateMint({
        chainId: store.chainId,
        amount: parsedAmount,
        destinationAddress: store.destinationAddress,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  function goToConfirmation() {
    if (isFormValid) store.setStep("confirmation");
  }

  function backToForm() {
    store.setStep("form");
  }

  async function proceedPayment() {
    const order = await createMintMutation.mutateAsync();
    store.setResult(order);
    store.setStep("status");
  }

  return {
    ...store,
    amountError,
    addressError,
    parsedAmount,
    paymentAmountIdr,
    exchangeRateIdr: USD_TO_IDR_RATE,
    fee,
    receiveAmount,
    selectedChain,
    isFormValid,
    goToConfirmation,
    backToForm,
    proceedPayment,
    isCreating: createMintMutation.isPending,
    mintOrder: createMintMutation.data,
  };
}
