"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { mockCreateRedeem, mockGetBankAccounts } from "@/lib/api/mock-api";
import { validateAmount } from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { MINTING_FEE_PERCENT, USD_TO_IDR_RATE } from "@/lib/constants";
import { getChainById } from "@/lib/chains";

const MOCK_WALLET = "0xRedeemMockWallet000000000000000000000000";

export function useRedeem() {
  const store = useRedeemStore();
  const queryClient = useQueryClient();

  const amountError = store.amount ? validateAmount(store.amount, "redeem") : null;

  const parsedAmount = parseAmount(store.amount);
  const receiveAmountIdr = parsedAmount * USD_TO_IDR_RATE;
  const fee = parsedAmount * MINTING_FEE_PERCENT;
  const selectedChain = useMemo(() => getChainById(store.chainId), [store.chainId]);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: mockGetBankAccounts,
  });
  const selectedBank = bankAccounts.find((a) => a.id === store.bankAccountId);

  const isFormValid =
    store.amount !== "" && store.bankAccountId !== "" && !amountError;

  const createRedeemMutation = useMutation({
    mutationFn: () =>
      mockCreateRedeem({
        chainId: store.chainId,
        amount: parsedAmount,
        bankAccountId: store.bankAccountId,
        walletAddress: MOCK_WALLET,
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

  async function proceedRedeem() {
    const order = await createRedeemMutation.mutateAsync();
    store.setResult(order);
    store.setStep("status");
  }

  return {
    ...store,
    amountError,
    parsedAmount,
    receiveAmountIdr,
    exchangeRateIdr: USD_TO_IDR_RATE,
    fee,
    selectedChain,
    selectedBank,
    isFormValid,
    goToConfirmation,
    backToForm,
    proceedRedeem,
    isProcessing: createRedeemMutation.isPending,
  };
}
