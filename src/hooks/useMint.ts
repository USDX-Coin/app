"use client";

// Mint form logic (USDX-201). Combines the mint store + live rate
// (GET /v2/rate) + validation + the create-order mutation (POST /v2/mint).
// On success it redirects to the own-hosted checkout (/mint/checkout/{id},
// USDX-202). The Ringkasan (review) is a modal, so there's no in-page step
// machine anymore — see mintStore.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMintStore } from "@/stores/mintStore";
import { useConsumerRate } from "@/hooks/useConsumerRate";
import { createMintOrder } from "@/lib/api/mint-api";
import { validateAmount, validateAddress } from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { isApiError } from "@/lib/api/errors";

// Maps a create-order failure to an i18n key the review modal renders inline
// (week2.md § Endpoints Mint error codes).
function mintErrorKey(error: unknown): string | null {
  if (!error) return null;
  if (isApiError(error)) {
    if (error.code === "RECIPIENT_BLACKLISTED") return "mint.errBlacklisted";
    if (error.code === "VALIDATION_ERROR") return "mint.errValidation";
    if (error.code === "MINT_DISABLED") return "mint.errDisabled";
    if (error.status === 403) return "mint.errGate"; // EMAIL/KYC/SUSPENDED gating
  }
  return "mint.errGeneric";
}

export function useMint() {
  const store = useMintStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const rateQuery = useConsumerRate();

  const effectiveBuyRate = rateQuery.data ? Number(rateQuery.data.effectiveBuyRate) : null;
  const enteredAmount = parseAmount(store.amount);

  // Derive the USDX amount + IDR subtotal from the entered currency + live rate.
  // "Anda akan bayar" = subtotal (before fee; fee is shown at checkout).
  const { amountUsdx, subtotalIdr } = useMemo(() => {
    if (!effectiveBuyRate || enteredAmount <= 0) return { amountUsdx: 0, subtotalIdr: 0 };
    return store.amountCurrency === "USD"
      ? { amountUsdx: enteredAmount, subtotalIdr: enteredAmount * effectiveBuyRate }
      : { amountUsdx: enteredAmount / effectiveBuyRate, subtotalIdr: enteredAmount };
  }, [enteredAmount, store.amountCurrency, effectiveBuyRate]);

  // Validate the USDX amount against the mint min/max. A USD input is itself the
  // USDX amount; an IDR input needs the rate to convert first (skip until loaded).
  const amountError = !store.amount
    ? null
    : store.amountCurrency === "USD"
      ? validateAmount(store.amount, "mint")
      : effectiveBuyRate
        ? validateAmount(String(amountUsdx), "mint")
        : null;

  const addressError = store.destinationAddress
    ? validateAddress(store.destinationAddress)
    : null;

  const selectedChain = useMemo(() => getChainById(store.chainId), [store.chainId]);

  const isFormValid =
    store.amount !== "" &&
    store.destinationAddress !== "" &&
    !amountError &&
    !addressError &&
    effectiveBuyRate != null &&
    amountUsdx > 0;

  const createMutation = useMutation({
    mutationFn: () =>
      createMintOrder({
        userAddress: store.destinationAddress.trim(),
        // Backend interprets `amount` by `amountCurrency`: USD = USDX amount,
        // IDR = subtotal (mint value). Pass the raw input either way.
        amount: store.amount.trim(),
        amountCurrency: store.amountCurrency,
        chain: store.chainId,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      router.push(`/mint/checkout/${order.id}`);
    },
  });

  function toggleCurrency() {
    store.setAmountCurrency(store.amountCurrency === "USD" ? "IDR" : "USD");
  }

  return {
    // form fields
    amount: store.amount,
    setAmount: store.setAmount,
    amountCurrency: store.amountCurrency,
    setAmountCurrency: store.setAmountCurrency,
    toggleCurrency,
    destinationAddress: store.destinationAddress,
    setDestinationAddress: store.setDestinationAddress,
    chainId: store.chainId,
    selectedChain,
    reset: store.reset,
    // rate
    rate: rateQuery.data ?? null,
    effectiveBuyRate,
    isRateLoading: rateQuery.isLoading,
    isRateError: rateQuery.isError,
    // derived amounts
    enteredAmount,
    amountUsdx,
    subtotalIdr,
    // validation
    amountError,
    addressError,
    isFormValid,
    // submit (create order → redirect to checkout)
    submitMint: () => createMutation.mutateAsync(),
    isCreating: createMutation.isPending,
    createErrorKey: mintErrorKey(createMutation.error),
    resetCreateError: createMutation.reset,
  };
}
