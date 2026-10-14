"use client";

// "Lihat kurs" beside the "Senilai" box of the mint form (D25 rev-15,
// `phase-2/week2.md § 1. Form Mint`). A small popover with each OFFERED method —
// Virtual Account with its buy rate, and Transfer BNI WITHOUT a number ("kurs
// mengikuti BNI di aplikasi wondr · tanpa biaya": since USDX-749 the customer
// sends USD from wondr and BNI converts their rupiah at its own rate, which we
// do not know — PM decision 14 Oct 2026) — plus "Metode dipilih di halaman
// pembayaran." Information only: the method, and its total with fees, belong to
// the payment page (checkout `/pay`). A row whose method is not offered is
// hidden — a rate nobody can pay with must not be shown (`rate.yaml`).

import { useLang } from "@/providers/LanguageProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A per-USDX rate in rupiah: "Rp 16.200", "Rp 16.412,50" — never rounded away. */
export function formatRateIDR(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  return `Rp ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}`;
}

interface MintRatesPopoverProps {
  /** Transfer BNI is offered (`paymentMethods[]`). Shown without a number. */
  offersBniTransfer: boolean;
  /** Virtual Account rate, null while no VA method is offered. */
  gatewayBuyRate: number | null;
}

export function MintRatesPopover({ offersBniTransfer, gatewayBuyRate }: MintRatesPopoverProps) {
  const { t } = useLang();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-sm text-sm font-medium text-primary-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          {t("mint.seeRates")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="flex flex-col gap-3"
        data-testid="mint-rate-details"
      >
        {gatewayBuyRate != null && (
          <div
            className="flex items-baseline justify-between gap-3 text-sm"
            data-testid="mint-rate-va"
          >
            <span className="text-foreground">{t("mint.rateVa")}</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatRateIDR(gatewayBuyRate)}
            </span>
          </div>
        )}
        {offersBniTransfer && (
          <div className="flex flex-col gap-0.5 text-sm" data-testid="mint-rate-bni">
            <span className="text-foreground">{t("mint.rateBni")}</span>
            <span className="text-xs text-muted-text">{t("mint.rateBniNote")}</span>
          </div>
        )}
        <p className="border-t border-border pt-3 text-xs text-muted-text">
          {t("mint.methodChosenLater")}
        </p>
      </PopoverContent>
    </Popover>
  );
}
