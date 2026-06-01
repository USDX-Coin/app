"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { mockCreateRedeem } from "@/lib/api/mock-api";
import { validateAmount } from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { MINTING_FEE_PERCENT, USD_TO_IDR_RATE } from "@/lib/constants";
import { getChainById } from "@/lib/chains";

export function useRedeem() {
  const store = useRedeemStore();
  const queryClient = useQueryClient();

  const amountError = store.amount ? validateAmount(store.amount, "redeem") : null;

  const parsedAmount = parseAmount(store.amount);
  // Redeem USDX, receive IDR (per Figma).
  const receiveAmountIdr = parsedAmount * USD_TO_IDR_RATE;
  const fee = parsedAmount * MINTING_FEE_PERCENT;
  const selectedChain = useMemo(() => getChainById(store.chainId), [store.chainId]);

  const isFormValid =
    store.amount !== "" && store.bankAccountId !== "" && !amountError;

  const createRedeemMutation = useMutation({
    mutationFn: (walletAddress: string) =>
      mockCreateRedeem({
        chainId: store.chainId,
        amount: parsedAmount,
        bankAccountId: store.bankAccountId,
        walletAddress,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  async function executeRedeem(walletAddress: string) {
    if (createRedeemMutation.isPending) return;
    await createRedeemMutation.mutateAsync(walletAddress);
  }

  return {
    ...store,
    amountError,
    parsedAmount,
    receiveAmountIdr,
    exchangeRateIdr: USD_TO_IDR_RATE,
    fee,
    selectedChain,
    isFormValid,
    executeRedeem,
    isExecuting: createRedeemMutation.isPending,
    redeemOrder: createRedeemMutation.data,
  };
}
