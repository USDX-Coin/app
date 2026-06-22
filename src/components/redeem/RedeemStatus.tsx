"use client";

// Redeem status tracker (USDX-243). Polls GET /v2/redeem/{id} and walks the
// lifecycle AWAITING_BURN → BURNED → PROCESSING_PAYOUT → PAYOUT_COMPLETE (or
// EXPIRED). Links the burn tx to the explorer, counts down the burn window while
// AWAITING_BURN, and shows the simulation notice (payout is mocked in W3).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { useRedeemStore } from "@/stores/redeemStore";
import { useRedeemTracker } from "@/hooks/useRedeemTracker";
import { useLang } from "@/providers/LanguageProvider";
import { cn, formatAmount, formatIDR, truncateAddress } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { REDEEM_CHAIN_ID } from "@/lib/constants";
import { env } from "@/lib/env";
import type { RedeemStatus as RedeemStatusEnum } from "@/types";

const STEPS: { key: RedeemStatusEnum; label: string; desc: string }[] = [
  { key: "AWAITING_BURN", label: "redeem.statusAwaitingBurn", desc: "redeem.statusAwaitingBurnDesc" },
  { key: "BURNED", label: "redeem.statusBurned", desc: "redeem.statusBurnedDesc" },
  { key: "PROCESSING_PAYOUT", label: "redeem.statusProcessing", desc: "redeem.statusProcessingDesc" },
  { key: "PAYOUT_COMPLETE", label: "redeem.statusComplete", desc: "redeem.statusCompleteDesc" },
];

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function RedeemStatus() {
  const { t } = useLang();
  const router = useRouter();
  const orderId = useRedeemStore((s) => s.orderId);
  const reset = useRedeemStore((s) => s.reset);
  const { data: order, isLoading } = useRedeemTracker(orderId);

  // Tick once a second so the burn-window countdown stays live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const chain = getChainById(REDEEM_CHAIN_ID);

  if (!order || isLoading) {
    return (
      <div className="flex w-full max-w-[500px] items-center justify-center rounded-xl border border-border bg-card p-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const isExpired = order.status === "EXPIRED";
  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const remainingSec =
    order.status === "AWAITING_BURN"
      ? (new Date(order.expiresAt).getTime() - now) / 1000
      : 0;

  return (
    <div className="flex w-full max-w-[500px] flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-medium tracking-tight text-foreground">{t("title.redeemStatus")}</h2>
        <p className="text-sm text-muted-foreground">
          {order.orderNumber}
          {order.lateBurn && <span className="ml-2 text-gold">{t("redeem.lateBurn")}</span>}
        </p>
      </div>

      {env.useMock && (
        <p className="rounded-lg bg-[#eef4fb] p-3 text-xs text-muted-foreground dark:bg-[#13243d]">
          {t("redeem.simulationNotice")}
        </p>
      )}

      {/* Lifecycle stepper */}
      <div className="flex flex-col">
        {STEPS.map((step, i) => {
          const done = !isExpired && (order.status === "PAYOUT_COMPLETE" || i < currentIndex);
          const active = !isExpired && i === currentIndex && order.status !== "PAYOUT_COMPLETE";
          const failed = isExpired && i === 0;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border",
                    done && "border-primary bg-primary text-white",
                    active && "border-primary text-primary",
                    failed && "border-destructive bg-destructive text-white",
                    !done && !active && !failed && "border-border text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-4" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : failed ? (
                    <X className="size-4" />
                  ) : (
                    <span className="text-xs">{i + 1}</span>
                  )}
                </span>
                {!isLast && (
                  <span className={cn("w-px flex-1 grow", done ? "bg-primary" : "bg-border")} style={{ minHeight: 28 }} />
                )}
              </div>
              <div className={cn("flex flex-col pb-5", isLast && "pb-0")}>
                <span className={cn("text-sm font-medium", active || done ? "text-foreground" : "text-muted-foreground")}>
                  {t(failed ? "redeem.statusExpired" : step.label)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(failed ? "redeem.statusExpiredDesc" : step.desc)}
                </span>
                {active && step.key === "AWAITING_BURN" && remainingSec > 0 && (
                  <span className="mt-1 text-xs text-gold">
                    {t("redeem.expiresIn", { time: formatMMSS(remainingSec) })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Burn tx + payout summary */}
      <div className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("sum.youWillRedeem")}</span>
          <span className="font-medium text-foreground">{formatAmount(Number(order.amount))} USDX</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("sum.bankDestination")}</span>
          <span className="font-medium text-foreground">{order.bankAccountNumberMasked}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("redeem.netPayout")}</span>
          <span className="font-semibold text-foreground">{formatIDR(Number(order.netPayoutIdr))}</span>
        </div>
        {order.burnTxHash && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <span className="text-muted-foreground">{t("redeem.burnTx")}</span>
            <a
              href={chain ? `${chain.explorerUrl}/tx/${order.burnTxHash}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {truncateAddress(order.burnTxHash, 6)}
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          {t("btn.backToRedeem")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/history")}
          className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white"
        >
          {t("btn.viewHistory")}
        </button>
      </div>
    </div>
  );
}
