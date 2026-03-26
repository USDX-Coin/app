"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChainSelector } from "@/components/shared/ChainSelector";
import { useMint } from "@/hooks/useMint";
import { formatAmount } from "@/lib/utils";
import { ArrowRight, BookOpen, ScanLine } from "lucide-react";
import { FieldError } from "@/components/ui/field-error";

export function MintForm() {
  const {
    amount,
    setAmount,
    chainId,
    setChainId,
    destinationAddress,
    setDestinationAddress,
    paymentAmount,
    amountError,
    addressError,
    isFormValid,
    goToReview,
  } = useMint();

  return (
    <div className="space-y-6">
      {/* You will mint */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          You will mint
        </h2>
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
        <FieldError message={amountError} />
      </div>

      {/* You will pay */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          You will pay
        </h2>
        <div className="flex items-center gap-3 rounded-xl border border-border p-4">
          <Input
            type="text"
            value={paymentAmount > 0 ? formatAmount(paymentAmount) : ""}
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

      {/* Destination address */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            To this address
          </h2>
          <button className="text-sm text-primary hover:underline flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            Add Address Book
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border p-4">
          <Input
            type="text"
            placeholder="Destination Address"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
            className="border-0 text-sm p-0 focus-visible:ring-0 flex-1"
          />
          <button className="text-muted-foreground hover:text-foreground">
            <BookOpen className="h-4 w-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground">
            <ScanLine className="h-4 w-4" />
          </button>
        </div>
        <FieldError message={addressError} />
      </div>

      {/* Review button */}
      <Button
        onClick={goToReview}
        disabled={!isFormValid}
        className="w-full bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-xl py-6 text-base"
      >
        <span className="flex-1">Review Mint</span>
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
