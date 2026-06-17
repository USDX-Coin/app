"use client";

// Checkout payment-method picker (USDX-202): VA (9 banks) / QRIS with the
// per-method "Biaya layanan" (pgFeeIdr) and a grand total. VA requires a bank
// before paying. On confirm → POST /v2/mint/{id}/pay. pgFee may be "—" when the
// fee is unknown (refresh without channels[] from GET — see useCheckout).

import { useState } from "react";
import type { MintChannelOption, PaymentChannel, VaBank } from "@/types";
import { formatIDR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

function feeLabel(pgFeeIdr: string): string {
  if (!pgFeeIdr) return "—";
  const n = Number(pgFeeIdr);
  return Number.isFinite(n) ? formatIDR(n) : "—";
}

interface PaymentMethodSelectorProps {
  channels: MintChannelOption[];
  totalBeforePgFeeIdr: string;
  isPaying: boolean;
  payErrorKey: string | null;
  onPay: (channel: PaymentChannel, bank: VaBank | null) => void;
  onCancel: () => void;
}

export function PaymentMethodSelector({
  channels,
  totalBeforePgFeeIdr,
  isPaying,
  payErrorKey,
  onPay,
  onCancel,
}: PaymentMethodSelectorProps) {
  const { t } = useLang();
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [bank, setBank] = useState<VaBank | null>(null);

  const selected = channels.find((c) => c.channel === channel) ?? null;
  const needsBank = channel === "VA" && !bank;
  const pgFeeNum =
    selected && selected.pgFeeIdr && Number.isFinite(Number(selected.pgFeeIdr))
      ? Number(selected.pgFeeIdr)
      : null;
  const grandTotal = pgFeeNum != null ? Number(totalBeforePgFeeIdr) + pgFeeNum : null;
  const canPay = channel !== null && !needsBank && !isPaying;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{t("checkout.choosePayment")}</p>

      <div className="flex flex-col gap-2">
        {channels.map((opt) => {
          const active = channel === opt.channel;
          return (
            <div
              key={opt.channel}
              className={cn("rounded-lg border", active ? "border-primary" : "border-border")}
            >
              <button
                type="button"
                onClick={() => {
                  setChannel(opt.channel);
                  setBank(null);
                }}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <span className="text-sm font-medium text-foreground">
                  {opt.channel === "VA" ? t("checkout.va") : t("checkout.qris")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("checkout.serviceFee")} {feeLabel(opt.pgFeeIdr)}
                </span>
              </button>
              {active && opt.channel === "VA" && opt.banks && (
                <div className="grid grid-cols-3 gap-1.5 border-t border-border p-3">
                  {opt.banks.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBank(b)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                        bank === b
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {grandTotal != null && (
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="font-medium text-foreground">{t("checkout.grandTotal")}</span>
          <span className="font-semibold text-foreground">{formatIDR(grandTotal)}</span>
        </div>
      )}

      {needsBank && <p className="text-xs text-muted-foreground">{t("checkout.pickBank")}</p>}
      {payErrorKey && (
        <p role="alert" className="text-sm text-destructive">
          {t(payErrorKey)}
        </p>
      )}

      <div className="mt-1 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPaying}
          className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          disabled={!canPay}
          onClick={() => channel && onPay(channel, bank)}
          className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {isPaying ? t("common.processing") : t("checkout.pay")}
        </button>
      </div>
    </div>
  );
}
