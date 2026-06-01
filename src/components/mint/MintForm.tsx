"use client";

import { useState } from "react";
import { ArrowDown, BookText, ScanLine } from "lucide-react";
import { useMint } from "@/hooks/useMint";
import { formatAmount } from "@/lib/utils";
import { TokenButton } from "@/components/shared/TokenButton";
import { NetworkTokenModal } from "@/components/shared/NetworkTokenModal";

export function MintForm() {
  const {
    amount,
    setAmount,
    chainId,
    setChainId,
    destinationAddress,
    setDestinationAddress,
    paymentAmountIdr,
    exchangeRateIdr,
    amountError,
    isFormValid,
    goToConfirmation,
    selectedChain,
  } = useMint();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex w-full max-w-[500px] flex-col gap-6 rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-medium tracking-tight text-foreground">Mint USDX</h2>

      <div className="flex flex-col gap-4">
        {/* Amount boxes with center swap */}
        <div className="relative flex flex-col gap-2">
          <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium text-muted-foreground">You will mint</p>
            <div className="flex items-center justify-between gap-2">
              <TokenButton chain={selectedChain} onClick={() => setModalOpen(true)} />
              <input
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium text-muted-foreground">You will pay</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-3 text-white">
                <span className="flex size-8 items-center justify-center rounded-full bg-gold text-sm font-semibold text-[#1a1a1a]">
                  Rp
                </span>
                <span className="text-base font-semibold tracking-tight">IDR</span>
              </div>
              <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {paymentAmountIdr > 0 ? formatAmount(paymentAmountIdr) : "0"}
              </p>
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card">
            <ArrowDown className="size-5 text-muted-foreground" />
          </div>
        </div>

        {amountError && <p className="-mt-2 text-sm text-destructive">{amountError}</p>}

        {/* Exchange rate */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Exchange rate</p>
          <p className="text-base font-medium tracking-tight text-foreground">
            1 USDX ≈ {formatAmount(exchangeRateIdr)} IDR
          </p>
        </div>

        {/* Destination address */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <p className="text-muted-foreground">To this address</p>
            <button type="button" className="text-gold underline-offset-2 hover:underline">
              Add address book
            </button>
          </div>
          <div className="flex items-center gap-2.5 rounded-md bg-muted p-3">
            <input
              placeholder="Select destination address"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <BookText className="size-4 shrink-0 text-muted-foreground" />
            <ScanLine className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!isFormValid}
        onClick={goToConfirmation}
        className="brand-gradient flex h-[42px] items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        Mint
      </button>

      <NetworkTokenModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Mint to"
        selectedChainId={chainId}
        onSelectChain={setChainId}
      />
    </div>
  );
}
