"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, BookText, ScanLine, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TokenButton } from "@/components/shared/TokenButton";
import { NetworkTokenModal } from "@/components/shared/NetworkTokenModal";
import { ConfirmationCard } from "@/components/shared/ConfirmationCard";
import { StatusCard } from "@/components/shared/StatusCard";
import { KycGateDialog } from "@/components/kyc/KycGateDialog";
import { useKycGate } from "@/hooks/useKycGate";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { getChainById } from "@/lib/chains";
import { validateAddress } from "@/lib/validations";
import { formatAmount, truncateAddress } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

type Step = "form" | "confirmation" | "status";

export function BridgeContent() {
  const { t } = useLang();
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [fromChain, setFromChain] = useState("base");
  const [toChain, setToChain] = useState("polygon");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [modal, setModal] = useState<null | "from" | "to">(null);
  const [result, setResult] = useState<{ id: string; createdAt: string } | null>(null);
  const gate = useKycGate();
  // Real on-chain USDX balance (USDX-396). `balanceUsdx` is non-null only when it
  // is actually known, so "Max" cannot fill an invented amount.
  const balance = useWalletBalance();
  const canMax = balance.balanceUsdx != null && balance.balanceUsdx > 0;

  const from = getChainById(fromChain);
  const to = getChainById(toChain);
  const addressError = address ? validateAddress(address) : null;
  const isValid = amount !== "" && Number(amount) > 0 && address !== "" && !addressError;
  const amountNum = amount !== "" ? Number(amount) : 0;

  const HEADERS: Record<Step, { crumbs: string[]; title: string }> = {
    form: { crumbs: ["crumb.transaction", "nav.bridge"], title: "title.bridge" },
    confirmation: { crumbs: ["crumb.transaction", "nav.bridge", "crumb.confirmationShort"], title: "title.bridgeConfirmation" },
    status: { crumbs: ["crumb.transaction", "nav.bridge", "crumb.status"], title: "title.bridgeStatus" },
  };

  function swap() {
    setFromChain(toChain);
    setToChain(fromChain);
  }
  function confirm() {
    setResult({ id: `bridge_${Date.now().toString(36)}`, createdAt: new Date().toISOString() });
    setStep("status");
  }
  function restart() {
    setStep("form");
    setAmount("");
    setAddress("");
  }

  const rows = [
    { label: t("sum.youWillBridge"), value: (<><img src="/image/usdx-logo.png" alt="" className="size-5 rounded-full" /> USDX</>) },
    { label: t("sum.from"), value: (<>{from && <img src={from.icon} alt="" className="size-4 rounded-sm" />}{from?.name}</>) },
    { label: t("sum.to"), value: (<>{to && <img src={to.icon} alt="" className="size-4 rounded-sm" />}{to?.name}</>) },
    { label: t("sum.recipient"), value: truncateAddress(address) },
    { label: t("sum.amount"), value: `${formatAmount(amountNum)} USDX` },
  ];

  return (
    <div className="flex flex-1 flex-col gap-2">
      <PageHeader crumbs={HEADERS[step].crumbs} title={HEADERS[step].title} />
      {/* `items-start`: horizontal centering only — `stretch` would pull the
          card down to the bottom of the page. */}
      <div className="flex flex-1 items-start justify-center pt-8">
        {step === "confirmation" && (
          <ConfirmationCard
            rows={rows}
            receiveLabel={t("sum.receiveAmount")}
            receiveValue={`${formatAmount(amountNum)} USDX`}
            onCancel={() => setStep("form")}
            onConfirm={confirm}
          />
        )}

        {step === "status" && (
          <StatusCard
            title={t("status.bridgeSubmitted")}
            network={to?.name}
            requestId={result ? `#${result.id.toUpperCase()}` : "#—"}
            submitted={result ? new Date(result.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
            rows={rows}
            receiveLabel={t("sum.receiveAmount")}
            receiveValue={`${formatAmount(amountNum)} USDX`}
            primaryLabel={t("btn.backToBridge")}
            onPrimary={restart}
            secondaryLabel={t("btn.viewHistory")}
            onSecondary={() => router.push("/history")}
          />
        )}

        {step === "form" && (
          <div className="flex w-full max-w-[500px] flex-col gap-6 rounded-xl border border-border bg-card p-5">
            <h2 className="text-xl font-medium tracking-tight text-foreground">{t("title.bridge")}</h2>
            <div className="flex flex-col gap-4">
              <div className="relative flex flex-col gap-2">
                <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-muted-foreground">{t("form.from")}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Wallet className="size-[18px] text-muted-foreground" />
                      {balance.balanceUsdx != null ? (
                        <>
                          <span className="text-muted-foreground">{formatAmount(balance.balanceUsdx)}</span>
                          <button type="button" disabled={!canMax} onClick={() => setAmount(String(balance.balanceUsdx))} className="font-semibold text-gold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50">{t("common.max")}</button>
                        </>
                      ) : balance.state === "disconnected" ? (
                        <button type="button" onClick={balance.connect} className="font-semibold text-gold underline-offset-2 hover:underline">{t("balance.connectWallet")}</button>
                      ) : (
                        /* Unknown balance → no number and no usable Max (USDX-396). */
                        <span className="text-muted-foreground">{balance.state === "loading" ? t("balance.loading") : t("balance.unavailable")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <TokenButton chain={from} onClick={() => setModal("from")} />
                    <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground" />
                  </div>
                </div>
                <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
                  <p className="text-sm font-medium text-muted-foreground">{t("form.to")}</p>
                  <div className="flex items-center justify-between gap-2">
                    <TokenButton chain={to} onClick={() => setModal("to")} />
                    <p className="truncate text-2xl font-semibold tracking-tight text-foreground">{amount !== "" ? formatAmount(amountNum) : "0"}</p>
                  </div>
                </div>
                <button type="button" onClick={swap} aria-label="Swap networks" className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowUpDown className="size-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <p className="text-muted-foreground">{t("form.toThisAddress")}</p>
                  <button type="button" className="text-gold underline-offset-2 hover:underline">{t("form.addAddressBook")}</button>
                </div>
                <div className="flex items-center gap-2.5 rounded-md bg-muted p-3">
                  <input placeholder={t("form.selectDestination")} value={address} onChange={(e) => setAddress(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                  <BookText className="size-4 shrink-0 text-muted-foreground" />
                  <ScanLine className="size-4 shrink-0 text-muted-foreground" />
                </div>
                {addressError && <p className="text-sm text-destructive">{addressError}</p>}
              </div>
            </div>
            <button type="button" disabled={gate.verified && !isValid} onClick={() => gate.guard(() => setStep("confirmation"))} className="brand-gradient flex h-[42px] items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50">
              {t("btn.bridge")}
            </button>
            <KycGateDialog open={gate.open} onOpenChange={gate.setOpen} status={gate.status} rejectionReason={gate.rejectionReason} />
            <NetworkTokenModal open={modal === "from"} onOpenChange={(o) => setModal(o ? "from" : null)} title={t("modal.bridgeFrom")} selectedChainId={fromChain} onSelectChain={setFromChain} />
            <NetworkTokenModal open={modal === "to"} onOpenChange={(o) => setModal(o ? "to" : null)} title={t("modal.bridgeTo")} selectedChainId={toChain} onSelectChain={setToChain} />
          </div>
        )}
      </div>
    </div>
  );
}
