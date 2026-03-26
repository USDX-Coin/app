"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChainSelector } from "@/components/shared/ChainSelector";
import { BankAccountSelector } from "./BankAccountSelector";
import { useRedeem } from "@/hooks/useRedeem";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { formatAmount } from "@/lib/utils";
import { ArrowRight, Plus, Wallet, AlertCircle } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export function RedeemForm() {
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
    receiveAmount,
  } = useRedeem();
  const { data: balance = 0 } = useWalletBalance(address);

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
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setAmount(String(balance))}
          >
            Max
          </button>
        </div>
      </div>

      {/* Amount input */}
      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <Input
          type="text"
          placeholder="Amount"
          value={amount}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, "");
            setAmount(val);
          }}
          className="border-0 text-lg font-medium p-0 focus-visible:ring-0 flex-1"
        />
        <ChainSelector selectedChainId={chainId} onSelect={setChainId} />
      </div>
      {amountError && (
        <p className="text-xs text-destructive flex items-center gap-1.5 mt-1 animate-fade-in"><AlertCircle className="h-3 w-3 shrink-0" />{amountError}</p>
      )}

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
            className="border-0 text-lg font-medium p-0 focus-visible:ring-0 flex-1 disabled:opacity-50"
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
          <button className="text-sm text-primary hover:underline flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add new recipient
          </button>
        </div>
        <BankAccountSelector
          value={bankAccountId}
          onSelect={setBankAccountId}
        />
      </div>

      {/* Review button */}
      <Button
        onClick={goToReview}
        disabled={!isFormValid}
        className="w-full bg-primary hover:bg-primary-600 rounded-xl py-6 text-base"
      >
        <span className="flex-1">Review Redeem</span>
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
