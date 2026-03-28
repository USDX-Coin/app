"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChainSelector } from "@/components/shared/ChainSelector";
import { BankAccountSelector } from "./BankAccountSelector";
import { AddRecipientDialog } from "./AddRecipientDialog";
import { useState } from "react";
import { useRedeem } from "@/hooks/useRedeem";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { cn, formatAmount } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Plus, Wallet } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export function RedeemForm() {
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const {
    amount,
    setAmount,
    chainId,
    setChainId,
    bankAccountId,
    setBankAccountId,
    amountError,
    isFormValid,
    goToReview,
    goBackToForm,
    receiveAmount,
    step,
  } = useRedeem();
  const { data: balance = 0 } = useWalletBalance(address);
  const isReviewing = step !== "form";

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Connect your wallet to redeem USDX
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          You will redeem
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          <span>{formatAmount(balance)} USDX</span>
          {!isReviewing && (
            <button
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setAmount(String(balance))}
            >
              Max
            </button>
          )}
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <div className={cn("rounded-xl border p-4", amountError ? "border-destructive" : "border-border")}>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="Amount"
              value={amount}
              disabled={isReviewing}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                setAmount(val);
              }}
              className="bg-transparent outline-none border-0 text-lg font-medium p-0 focus-visible:ring-0 flex-1 dark:bg-transparent shadow-none disabled:opacity-70 disabled:cursor-default"
            />
            <ChainSelector selectedChainId={chainId} onSelect={setChainId} disabled={isReviewing} />
          </div>
        </div>
        <div className="h-[20px]">
          {amountError && <p className="text-sm text-destructive mt-2">{amountError}</p>}
        </div>
      </div>

      {/* You will receive */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          You will receive
        </h2>
        <div className="flex items-center gap-3 rounded-xl border border-border p-4">
          <Input
            type="text"
            value={receiveAmount > 0 ? formatAmount(receiveAmount) : ""}
            placeholder="Amount"
            disabled
            className="bg-transparent outline-none border-0 text-lg font-medium p-0 focus-visible:ring-0 flex-1 disabled:opacity-70 disabled:cursor-default dark:bg-transparent shadow-none"
          />
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-xs">
              $
            </div>
            USD
          </div>
        </div>
      </div>

      {/* Exchange rate */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Exchange rate
        </h2>
        <p className="text-sm text-muted-foreground">1 USDX = 1 USD</p>
      </div>

      {/* Bank Account */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">To</h2>
          {!isReviewing && (
            <button
              className="text-sm text-primary hover:underline flex items-center gap-1"
              onClick={() => setRecipientDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add new recipient
            </button>
          )}
        </div>
        <BankAccountSelector
          value={bankAccountId}
          onSelect={setBankAccountId}
          disabled={isReviewing}
        />
        <AddRecipientDialog open={recipientDialogOpen} onOpenChange={setRecipientDialogOpen} />
      </div>

      {/* Button */}
      {isReviewing ? (
        <Button
          onClick={goBackToForm}
          variant="outline"
          className="w-full rounded-xl py-6 text-base flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          Change Amount
        </Button>
      ) : (
        <Button
          onClick={goToReview}
          disabled={!isFormValid}
          className="w-full bg-linear-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-xl py-6 text-base"
        >
          <span className="flex-1">Review Redeem</span>
          <ArrowRight className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
