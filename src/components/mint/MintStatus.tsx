"use client";

import { useRouter } from "next/navigation";
import { Hourglass } from "lucide-react";
import { useMint } from "@/hooks/useMint";
import { useMintStore } from "@/stores/mintStore";
import { formatAmount, truncateAddress } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-foreground">{children}</span>
    </div>
  );
}

export function MintStatus() {
  const router = useRouter();
  const { selectedChain, destinationAddress, parsedAmount, exchangeRateIdr } = useMint();
  const reset = useMintStore((s) => s.reset);
  const result = useMintStore((s) => s.result);

  const requestId = result ? `#${result.id.toUpperCase()}` : "#—";
  const submitted = result
    ? new Date(result.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-6 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Hourglass className="size-9 text-gold" />
        <h2 className="text-lg font-medium text-foreground">Mint Request Submitted</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your transaction has been successfully submitted to the {selectedChain?.name} network and
          is awaiting confirmation.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-5">
        <Row label="Request ID">{requestId}</Row>
        <Row label="Submitted">{submitted}</Row>
        <Row label="Status">
          <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            Pending
          </span>
        </Row>

        <p className="pt-1 text-base font-medium text-foreground">Transaction Summary</p>
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
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-base font-medium text-foreground">Receive Amount</span>
          <span className="text-base font-semibold text-foreground">
            {formatAmount(parsedAmount)} USDX
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white"
        >
          Back to Mint
        </button>
        <button
          type="button"
          onClick={() => router.push("/transactions")}
          className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          View History
        </button>
      </div>
    </div>
  );
}
