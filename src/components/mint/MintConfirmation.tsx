"use client";

import { useMint } from "@/hooks/useMint";
import { formatAmount, truncateAddress } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-foreground">{children}</span>
    </div>
  );
}

export function MintConfirmation() {
  const {
    selectedChain,
    destinationAddress,
    parsedAmount,
    exchangeRateIdr,
    backToForm,
    proceedPayment,
    isCreating,
  } = useMint();

  return (
    <div className="flex w-full max-w-[500px] flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-medium text-foreground">Transaction Summary</h2>
        <div className="flex flex-col gap-3">
          <Row label="You will mint">
            <img src="/image/Logo.svg" alt="" className="size-5 rounded-full" /> USDX
          </Row>
          <Row label="Network">
            {selectedChain && <img src={selectedChain.icon} alt="" className="size-4 rounded-sm" />}
            {selectedChain?.name}
          </Row>
          <Row label="Recipient Address">{truncateAddress(destinationAddress)}</Row>
          <Row label="Exchange rate">1 USDX ≈ {formatAmount(exchangeRateIdr)} IDR</Row>
          <Row label="Amount">{formatAmount(parsedAmount)} USDX</Row>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-base font-medium text-foreground">Receive Amount</span>
          <span className="text-base font-semibold text-foreground">
            {formatAmount(parsedAmount)} USDX
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-[#eef4fb] p-3 text-sm text-foreground dark:bg-[#13243d]">
        <span className="font-semibold">Note:</span> Please verify all details carefully. Mint
        transactions are irreversible once confirmed.
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={backToForm}
          className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={proceedPayment}
          disabled={isCreating}
          className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {isCreating ? "Processing..." : "Proceed Payment"}
        </button>
      </div>
    </div>
  );
}
