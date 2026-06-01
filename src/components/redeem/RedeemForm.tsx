"use client";

import { useState } from "react";
import { ArrowDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useRedeem } from "@/hooks/useRedeem";
import { useRedeemStore } from "@/stores/redeemStore";
import { formatAmount } from "@/lib/utils";
import { TokenButton } from "@/components/shared/TokenButton";
import { NetworkTokenModal } from "@/components/shared/NetworkTokenModal";
import { BankAccountSelector } from "./BankAccountSelector";
import { AddRecipientDialog } from "./AddRecipientDialog";

// Mock redeemable balance (data is mocked; sidebar holds the headline balance).
const REDEEMABLE_BALANCE = 999105.89;
const MOCK_WALLET = "0xRedeemMockWallet000000000000000000000000";

export function RedeemForm() {
  const {
    amount,
    setAmount,
    chainId,
    setChainId,
    bankAccountId,
    setBankAccountId,
    amountError,
    receiveAmountIdr,
    exchangeRateIdr,
    isFormValid,
    selectedChain,
    executeRedeem,
    isExecuting,
  } = useRedeem();
  const reset = useRedeemStore((s) => s.reset);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [recipientOpen, setRecipientOpen] = useState(false);

  async function handleRedeem() {
    await executeRedeem(MOCK_WALLET);
    toast.success("Redeem request submitted");
    reset();
  }

  return (
    <div className="flex w-full max-w-[500px] flex-col gap-6 rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-medium tracking-tight text-foreground">Redeem USDX</h2>

      <div className="flex flex-col gap-4">
        <div className="relative flex flex-col gap-2">
          {/* You will redeem */}
          <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">You will redeem</p>
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="size-[18px] text-muted-foreground" />
                <span className="text-muted-foreground">{formatAmount(REDEEMABLE_BALANCE)}</span>
                <button
                  type="button"
                  onClick={() => setAmount(String(REDEEMABLE_BALANCE))}
                  className="font-semibold text-gold underline-offset-2 hover:underline"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <TokenButton chain={selectedChain} onClick={() => setNetworkOpen(true)} />
              <input
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* You will receive */}
          <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium text-muted-foreground">You will receive</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-white">
                <span className="flex size-8 items-center justify-center rounded-full bg-gold text-sm font-semibold text-[#1a1a1a]">
                  Rp
                </span>
                <span className="text-base font-semibold tracking-tight">IDR</span>
              </div>
              <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {receiveAmountIdr > 0 ? formatAmount(receiveAmountIdr) : "0"}
              </p>
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card">
            <ArrowDown className="size-5 text-muted-foreground" />
          </div>
        </div>

        {amountError && <p className="-mt-2 text-sm text-destructive">{amountError}</p>}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Exchange rate</p>
          <p className="text-base font-medium tracking-tight text-foreground">
            1 USDX ≈ {formatAmount(exchangeRateIdr)} IDR
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <p className="text-muted-foreground">To this bank account</p>
            <button
              type="button"
              onClick={() => setRecipientOpen(true)}
              className="text-gold underline-offset-2 hover:underline"
            >
              Add new recipient
            </button>
          </div>
          <BankAccountSelector value={bankAccountId} onSelect={setBankAccountId} />
        </div>
      </div>

      <button
        type="button"
        disabled={!isFormValid || isExecuting}
        onClick={handleRedeem}
        className="brand-gradient flex h-[42px] items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {isExecuting ? "Processing..." : "Redeem"}
      </button>

      <NetworkTokenModal
        open={networkOpen}
        onOpenChange={setNetworkOpen}
        title="Redeem From"
        selectedChainId={chainId}
        onSelectChain={setChainId}
      />
      <AddRecipientDialog open={recipientOpen} onOpenChange={setRecipientOpen} />
    </div>
  );
}
