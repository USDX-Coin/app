"use client";

import { Button } from "@/components/ui/button";
import { useMint } from "@/hooks/useMint";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { Copy, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function MintReview() {
  const {
    selectedChain,
    destinationAddress,
    parsedAmount,
    fee,
    paymentAmount,
    goBackToForm,
    proceedPayment,
    isCreating,
  } = useMint();

  function handleCopyAddress() {
    navigator.clipboard.writeText(destinationAddress);
    toast.success("Address copied!");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Mint Detail</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Network</span>
          <span className="text-sm font-medium">
            {selectedChain?.shortName}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Destination Address
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {truncateAddress(destinationAddress)}
            </span>
            <button
              onClick={handleCopyAddress}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Minting amount</span>
          <span className="text-sm font-medium">
            {formatAmount(parsedAmount)} USDX
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          A <strong>0.7% minting fee</strong> (${formatAmount(fee)}) will be
          charged and deducted from the minting amount.
        </p>

        <div className="border-t border-border pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Total payment</span>
          <span className="text-sm font-bold">
            {formatAmount(paymentAmount)} USD
          </span>
        </div>
      </div>

      <Button
        onClick={proceedPayment}
        disabled={isCreating}
        className="w-full bg-primary hover:bg-primary-600 rounded-xl py-6 text-base"
      >
        <span className="flex-1">
          {isCreating ? "Processing..." : "Proceed Payment"}
        </span>
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
