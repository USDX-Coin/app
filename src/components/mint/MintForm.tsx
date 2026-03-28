"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChainSelector } from "@/components/shared/ChainSelector";
import { useMint } from "@/hooks/useMint";
import { cn, formatAmount } from "@/lib/utils";
import { ArrowLeft, ArrowRight, BookOpen, ScanLine } from "lucide-react";

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
    goBackToForm,
    step,
  } = useMint();

  const isReviewing = step === "review";

  return (
    <div className="space-y-6">
      {/* You will mint */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          You will mint
        </h2>
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

      {/* Destination address */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            To this address
          </h2>
          {!isReviewing && (
            <button className="text-sm text-primary hover:underline flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              Add Address Book
            </button>
          )}
        </div>
        <div className="space-y-2">
          <div className={cn("rounded-xl border p-4", addressError ? "border-destructive" : "border-border")}>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Destination Address"
                value={destinationAddress}
                disabled={isReviewing}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="bg-transparent outline-none border-0 text-sm p-0 focus-visible:ring-0 flex-1 dark:bg-transparent shadow-none disabled:opacity-70 disabled:cursor-default"
              />
              {!isReviewing && (
                <>
                  <button className="text-muted-foreground hover:text-foreground">
                    <BookOpen className="h-4 w-4" />
                  </button>
                  <button className="text-muted-foreground hover:text-foreground">
                    <ScanLine className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="h-[20px]">
            {addressError && <p className="text-sm text-destructive mt-2">{addressError}</p>}
          </div>
        </div>
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
          <span className="flex-1">Review Mint</span>
          <ArrowRight className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
