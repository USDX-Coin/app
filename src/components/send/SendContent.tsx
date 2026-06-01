"use client";

import { useState } from "react";
import { BookText, ScanLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { TokenButton } from "@/components/shared/TokenButton";
import { NetworkTokenModal } from "@/components/shared/NetworkTokenModal";
import { getChainById } from "@/lib/chains";
import { validateAddress } from "@/lib/validations";
import { formatAmount } from "@/lib/utils";

const BALANCE = 999105.89;

export function SendContent() {
  const [chain, setChain] = useState("base");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const addressError = address ? validateAddress(address) : null;
  const isValid = amount !== "" && Number(amount) > 0 && address !== "" && !addressError;

  function handleSend() {
    toast.success("Send request submitted");
    setAmount("");
    setAddress("");
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={["Transaction", "Send"]} title="Send USDX" />
      <div className="flex flex-1 justify-center pt-8">
        <div className="flex w-full max-w-[500px] flex-col gap-6 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-medium tracking-tight text-foreground">Send USDX</h2>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">You will send</p>
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="size-[18px] text-muted-foreground" />
                  <span className="text-muted-foreground">{formatAmount(BALANCE)}</span>
                  <button
                    type="button"
                    onClick={() => setAmount(String(BALANCE))}
                    className="font-semibold text-gold underline-offset-2 hover:underline"
                  >
                    Max
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <TokenButton chain={getChainById(chain)} onClick={() => setModalOpen(true)} />
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

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
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <BookText className="size-4 shrink-0 text-muted-foreground" />
                <ScanLine className="size-4 shrink-0 text-muted-foreground" />
              </div>
              {addressError && <p className="text-sm text-destructive">{addressError}</p>}
            </div>
          </div>

          <button
            type="button"
            disabled={!isValid}
            onClick={handleSend}
            className="brand-gradient flex h-[42px] items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            Send
          </button>

          <NetworkTokenModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title="Send From"
            selectedChainId={chain}
            onSelectChain={setChain}
          />
        </div>
      </div>
    </div>
  );
}
