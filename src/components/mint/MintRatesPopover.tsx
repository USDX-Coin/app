"use client";

// "Lihat kurs" beside the "Senilai" box of the mint form (D25 rev-15,
// `phase-2/week2.md § 1. Form Mint`). A small popover with the buy rate of each
// OFFERED method — Transfer BNI (the desk's rate, as in wondr by BNI, with the
// time it was updated) and Virtual Account — plus "Metode dipilih di halaman
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

/** "09.15 WIB" — the desk's rate time, always in Jakarta time. Null on a bad value. */
export function formatRateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(d);
  return `${time} WIB`;
}

interface MintRatesPopoverProps {
  /** Transfer BNI rate, null while that method is not offered. */
  bniTransferBuyRate: number | null;
  bniTransferBuyRateUpdatedAt: string | null;
  /** Virtual Account rate, null while no VA method is offered. */
  gatewayBuyRate: number | null;
}

export function MintRatesPopover({
  bniTransferBuyRate,
  bniTransferBuyRateUpdatedAt,
  gatewayBuyRate,
}: MintRatesPopoverProps) {
  const { t } = useLang();
  const updated = formatRateTime(bniTransferBuyRateUpdatedAt);

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
        {bniTransferBuyRate != null && (
          <div className="flex flex-col gap-0.5" data-testid="mint-rate-bni">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-foreground">{t("mint.rateBni")}</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatRateIDR(bniTransferBuyRate)}
              </span>
            </div>
            <span className="text-xs text-muted-text">
              {t("mint.rateBniSource")}
              {updated && <> · {t("mint.rateUpdated", { time: updated })}</>}
            </span>
          </div>
        )}
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
        <p className="border-t border-border pt-3 text-xs text-muted-text">
          {t("mint.methodChosenLater")}
        </p>
      </PopoverContent>
    </Popover>
  );
}
