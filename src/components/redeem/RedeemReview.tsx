"use client";

import { Button } from "@/components/ui/button";
import { useRedeem } from "@/hooks/useRedeem";
import { useQuery } from "@tanstack/react-query";
import { mockGetBankAccounts } from "@/lib/api/mock-api";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { ArrowRight, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";

export function RedeemReview() {
  const { address } = useAccount();
  const {
    step,
    selectedChain,
    parsedAmount,
    fee,
    receiveAmount,
    bankAccountId,
    goBackToForm,
    executeRedeem,
    isExecuting,
    redeemOrder,
    reset,
  } = useRedeem();

  const { data: accounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: mockGetBankAccounts,
  });
  const selectedBank = accounts.find((a) => a.id === bankAccountId);

  if (step === "success" && redeemOrder) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold">Redeem Successful</h2>
        <p className="text-sm text-muted-foreground">
          {formatAmount(redeemOrder.amount)} USDX has been redeemed.
          ${formatAmount(redeemOrder.totalReceiveUsd)} will be sent to your bank
          account within 24 hours.
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          Tx: {truncateAddress(redeemOrder.txHash, 8)}
        </p>
        <Button
          onClick={reset}
          className="w-full bg-primary hover:bg-primary-600"
        >
          New Redemption
        </Button>
      </div>
    );
  }

  if (step === "executing") {
    return (
      <div className="text-center space-y-4 py-8">
        <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
        <h2 className="text-lg font-semibold">Executing Smart Contract...</h2>
        <p className="text-sm text-muted-foreground">
          Please wait while we process your redemption
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Redeem Detail</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Network</span>
          <span className="text-sm font-medium">
            {selectedChain?.shortName}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Wallet</span>
          <span className="text-sm font-medium font-mono">
            {address ? truncateAddress(address) : "-"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Redeem amount</span>
          <span className="text-sm font-medium">
            {formatAmount(parsedAmount)} USDX
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bank Account</span>
          <span className="text-sm font-medium">
            {selectedBank
              ? `${selectedBank.bankName} ${selectedBank.accountNumber}`
              : "-"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Fee (0.7%)</span>
          <span className="text-sm font-medium">
            ${formatAmount(fee)}
          </span>
        </div>

        <div className="border-t border-border pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold">You will receive</span>
          <span className="text-sm font-bold">
            ${formatAmount(receiveAmount)}
          </span>
        </div>
      </div>

      <Button
        onClick={() => executeRedeem(address ?? "")}
        disabled={isExecuting}
        className="w-full bg-primary hover:bg-primary-600 rounded-xl py-6 text-base"
      >
        <span className="flex-1">Execute Redeem</span>
        <ArrowRight className="h-5 w-5" />
      </Button>

      <Button
        onClick={goBackToForm}
        variant="outline"
        className="w-full rounded-xl py-6 text-base"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Change Amount
      </Button>
    </div>
  );
}
