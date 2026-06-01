"use client";

import { useState } from "react";
import { ArrowUpDown, BookText, ScanLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { TokenButton } from "@/components/shared/TokenButton";
import { NetworkTokenModal } from "@/components/shared/NetworkTokenModal";
import { getChainById } from "@/lib/chains";
import { validateAddress } from "@/lib/validations";
import { formatAmount } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

const BALANCE = 999105.89;

export function BridgeContent() {
  const { t } = useLang();
  const [fromChain, setFromChain] = useState("base");
  const [toChain, setToChain] = useState("polygon");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [modal, setModal] = useState<null | "from" | "to">(null);

  const addressError = address ? validateAddress(address) : null;
  const isValid = amount !== "" && Number(amount) > 0 && address !== "" && !addressError;

  function swap() {
    setFromChain(toChain);
    setToChain(fromChain);
  }

  function handleBridge() {
    toast.success(t("toast.bridgeSubmitted"));
    setAmount("");
    setAddress("");
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={["crumb.transaction", "nav.bridge"]} title="title.bridge" />
      <div className="flex flex-1 justify-center pt-8">
        <div className="flex w-full max-w-[500px] flex-col gap-6 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-medium tracking-tight text-foreground">{t("title.bridge")}</h2>

          <div className="flex flex-col gap-4">
            <div className="relative flex flex-col gap-2">
              <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{t("form.from")}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Wallet className="size-[18px] text-muted-foreground" />
                    <span className="text-muted-foreground">{formatAmount(BALANCE)}</span>
                    <button
                      type="button"
                      onClick={() => setAmount(String(BALANCE))}
                      className="font-semibold text-gold underline-offset-2 hover:underline"
                    >
                      {t("common.max")}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <TokenButton chain={getChainById(fromChain)} onClick={() => setModal("from")} />
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
                <p className="text-sm font-medium text-muted-foreground">{t("form.to")}</p>
                <div className="flex items-center justify-between gap-2">
                  <TokenButton chain={getChainById(toChain)} onClick={() => setModal("to")} />
                  <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
                    {amount !== "" ? formatAmount(Number(amount)) : "0"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={swap}
                aria-label="Swap networks"
                className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowUpDown className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <p className="text-muted-foreground">{t("form.toThisAddress")}</p>
                <button type="button" className="text-gold underline-offset-2 hover:underline">
                  {t("form.addAddressBook")}
                </button>
              </div>
              <div className="flex items-center gap-2.5 rounded-md bg-muted p-3">
                <input
                  placeholder={t("form.selectDestination")}
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
            onClick={handleBridge}
            className="brand-gradient flex h-[42px] items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {t("btn.bridge")}
          </button>

          <NetworkTokenModal
            open={modal === "from"}
            onOpenChange={(o) => setModal(o ? "from" : null)}
            title={t("modal.bridgeFrom")}
            selectedChainId={fromChain}
            onSelectChain={setFromChain}
          />
          <NetworkTokenModal
            open={modal === "to"}
            onOpenChange={(o) => setModal(o ? "to" : null)}
            title={t("modal.bridgeTo")}
            selectedChainId={toChain}
            onSelectChain={setToChain}
          />
        </div>
      </div>
    </div>
  );
}
