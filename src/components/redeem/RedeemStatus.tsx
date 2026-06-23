"use client";

// Redeem status tracker (USDX-243, hardened USDX-259). Polls GET /v2/redeem/{id}
// and walks the lifecycle AWAITING_BURN → BURNED → PROCESSING_PAYOUT →
// PAYOUT_COMPLETE (or EXPIRED). While AWAITING_BURN it hosts the burn action —
// for the fresh-create flow (burn auto-runs) and the resume-from-/history flow
// (reconnect wallet, then burn). The burn is guarded against double-submit and
// bound to the order's wallet (week3.md § Guard double-burn / Resume). Links the
// burn tx to the explorer, counts down the burn window, surfaces the optimistic
// "memproses burn" state + the stale-burn hold, and shows the simulation notice.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, Loader2, X } from "lucide-react";
import { useRedeemStore } from "@/stores/redeemStore";
import { useRedeemTracker } from "@/hooks/useRedeemTracker";
import { useRedeemPreconditions } from "@/lib/redeem/wallet";
import { useRedeemBurn } from "@/hooks/useRedeemBurn";
import { useLang } from "@/providers/LanguageProvider";
import { cn, formatAmount, formatIDR, truncateAddress } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { REDEEM_CHAIN_ID } from "@/lib/constants";
import { env } from "@/lib/env";
import type { RedeemOrderDetail, RedeemStatus as RedeemStatusEnum } from "@/types";

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

  // Preconditions + burn action (hooks must run before any early return). The
  // amount is 0 until the order loads — preconditions stay inert until then.
  const amountUsdx = order ? Number(order.amount) : 0;
  const pre = useRedeemPreconditions(amountUsdx);
  const { runBurn, burnState, burnErrorKey } = useRedeemBurn();

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

      {/* Stale burn: burned past the late-burn grace → payout held for manual
          reconcile (week3.md § Late-burn cutoff, USDX-259). */}
      {order.staleBurn && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          {t("redeem.staleBurn")}
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

      {/* Burn action gate — only while awaiting the on-chain burn (USDX-259). */}
      {order.status === "AWAITING_BURN" && (
        <BurnGate
          order={order}
          pre={pre}
          burnState={burnState}
          burnErrorKey={burnErrorKey}
          onBurn={() => runBurn(order, pre.address ?? "")}
        />
      )}

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

// Burn action while AWAITING_BURN. Resolves the precondition + guard state and
// renders exactly one affordance: processing → connect → wallet-mismatch →
// switch-network → insufficient → Burn (with retry on a failed/rejected tx).
function BurnGate({
  order,
  pre,
  burnState,
  burnErrorKey,
  onBurn,
}: {
  order: RedeemOrderDetail;
  pre: ReturnType<typeof useRedeemPreconditions>;
  burnState: ReturnType<typeof useRedeemBurn>["burnState"];
  burnErrorKey: string | null;
  onBurn: () => void;
}) {
  const { t } = useLang();

  // Optimistically broadcast/reported but not yet confirmed by the scanner.
  const burnInFlight =
    burnState === "submitting" || burnState === "submitted" || order.burnSubmittedAt != null;
  if (burnInFlight) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        {t("redeem.burnProcessing")}
      </p>
    );
  }

  // Resume: the connected wallet must equal the wallet the order is bound to
  // (the scanner only accepts a burn from order.userAddress).
  const walletMatches =
    !!pre.address &&
    !!order.userAddress &&
    pre.address.toLowerCase() === order.userAddress.toLowerCase();

  const burnButton = (
    <button
      type="button"
      onClick={onBurn}
      disabled={!pre.canBurn || !walletMatches}
      className="brand-gradient flex h-[42px] w-full items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
    >
      {burnState === "error" ? t("redeem.retryBurn") : t("redeem.burnNow")}
    </button>
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      {!pre.isConnected ? (
        <button
          type="button"
          onClick={pre.connect}
          className="brand-gradient flex h-[42px] w-full items-center justify-center rounded-lg text-sm font-medium text-white"
        >
          {t("btn.connectWallet")}
        </button>
      ) : !walletMatches ? (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("redeem.walletMismatch", { address: truncateAddress(order.userAddress, 6) })}
        </p>
      ) : !pre.chainOk ? (
        <>
          <p className="flex items-center gap-2 text-sm text-foreground">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            {t("redeem.wrongNetwork")}
          </p>
          <button
            type="button"
            onClick={pre.switchNetwork}
            disabled={pre.isSwitchingNetwork}
            className="self-start rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {pre.isSwitchingNetwork ? t("redeem.switchingNetwork") : t("redeem.switchNetwork")}
          </button>
        </>
      ) : pre.insufficientBalance ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {t("redeem.insufficientBalance")}
        </p>
      ) : (
        <>
          {pre.lowGasWarning && (
            <p className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              {t("redeem.lowGas")}
            </p>
          )}
          {burnState === "error" && burnErrorKey && (
            <p role="alert" className="text-sm text-destructive">
              {t(burnErrorKey)}
            </p>
          )}
          {burnButton}
        </>
      )}
    </div>
  );
}
