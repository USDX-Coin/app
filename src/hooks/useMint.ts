"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMintStore } from "@/stores/mintStore";
import { mockCreateMint } from "@/lib/api/mock-api";
import { validateAmount, validateAddress } from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { EXCHANGE_RATE, MINTING_FEE_PERCENT } from "@/lib/constants";
import { getChainById } from "@/lib/chains";

export function useMint() {
  const store = useMintStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const amountError = store.amount ? validateAmount(store.amount, "mint") : null;
  const addressError = store.destinationAddress
    ? validateAddress(store.destinationAddress)
    : null;

  const parsedAmount = parseAmount(store.amount);
  const paymentAmount = parsedAmount * EXCHANGE_RATE;
  const fee = parsedAmount * MINTING_FEE_PERCENT;
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

  function goToReview() {
    if (isFormValid) store.setStep("review");
  }

  function goBackToForm() {
    store.setStep("form");
  }

  async function proceedPayment() {
    await createMintMutation.mutateAsync();
    store.setStep("payment");
    router.push("/payment");
  }

  return {
    ...store,
    amountError,
    addressError,
    parsedAmount,
    paymentAmount,
    fee,
    selectedChain,
    isFormValid,
    goToReview,
    goBackToForm,
    proceedPayment,
    isCreating: createMintMutation.isPending,
    mintOrder: createMintMutation.data,
  };
}
