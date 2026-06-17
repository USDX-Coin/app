"use client";

// 3-dimension mint status tracker (USDX-202): Payment → On-chain → Done, derived
// from the order's paymentStatus + overall status (conventions.md § Status Enums).
// Polled by the checkout via GET /v2/mint/{id}.

import { Check, Loader2, X } from "lucide-react";
import type { MintOrderDetail } from "@/types";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

const STEP_KEYS = ["checkout.trackPayment", "checkout.trackProcessing", "checkout.trackDone"];

type StepState = "done" | "active" | "pending";

function stepStates(order: MintOrderDetail): StepState[] {
  const paid = order.paymentStatus === "PAID";
  const completed = order.status === "COMPLETED";
  return [
    paid ? "done" : "active", // payment
    !paid ? "pending" : completed ? "done" : "active", // on-chain
    completed ? "done" : "pending", // done
  ];
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done")
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white">
        <Check className="size-3.5" />
      </span>
    );
  if (state === "active")
    return (
      <span className="flex size-6 items-center justify-center rounded-full border border-primary text-primary">
        <Loader2 className="size-3.5 animate-spin" />
      </span>
    );
  return <span className="flex size-6 items-center justify-center rounded-full border border-border" />;
}

export function MintStatusTracker({ order }: { order: MintOrderDetail }) {
  const { t } = useLang();

  if (order.status === "FAILED") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        <X className="size-4" /> {t("checkout.trackFailed")}
      </div>
    );
  }

  const states = stepStates(order);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">{t("checkout.statusTitle")}</p>
      <ol className="flex flex-col gap-2.5">
        {STEP_KEYS.map((key, i) => (
          <li key={key} className="flex items-center gap-2.5">
            <StepIcon state={states[i]} />
            <span
              className={cn(
                "text-sm",
                states[i] === "pending" ? "text-muted-foreground" : "font-medium text-foreground",
              )}
            >
              {t(key)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
