// Mint buy rates (D25 — `bni-integration.md` §4.3.3/§4.3.4, `api/rate.yaml §
// ConsumerRate`, `api/app-config.yaml § paymentMethods`).
//
// A consumer mint has TWO buy rates, one per method:
//   - Transfer BNI    (`BANK_TRANSFER`) = the BNI rate the desk copies from wondr
//   - Virtual Account (`VA`)            = base rate × (1 + Y/100)
// The method is chosen later, in checkout (`POST /api/v2/mint/{id}/pay`), and the
// total per method (fees included) is shown only there.
//
// The form converts with the CHEAPEST buy rate among the methods the backend is
// offering right now, both ways: "Senilai Rp Y" = USDX × that rate, and a rupiah
// entry → USDX = rupiah ÷ that rate — the same divisor create uses to lock the
// USDX amount (PM 3 Okt 2026, rev-15).
//
// Which methods are offered is the backend's answer, never ours: a rate counts
// only when its method is in `paymentMethods[]` (admin-set from the back office)
// AND the rate endpoint gives a usable number for it. Pure, like
// `lib/redeem/fees.ts`.

import type { ConsumerRate, PaymentMethodSummary } from "@/types";

export interface OfferedBuyRates {
  /** Transfer BNI rate, or null when that method is not offered. */
  bniTransfer: number | null;
  /** Virtual Account rate, or null when no VA method is offered. */
  gateway: number | null;
}

/** A decimal string from the API → a positive number, or null. Never a guessed 0. */
function positiveRate(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The buy rate of every OFFERED method. Null while either answer is missing —
 * the rate or the method list — because without both the app cannot know which
 * rates may be used.
 *
 * A rate whose method is not offered is dropped (`rate.yaml`: the FE must not
 * show a rate nobody can pay with), and so is an offered method without a usable
 * rate. `QRIS` has no D25 rate of its own and is not counted.
 */
export function offeredBuyRates(
  rate: ConsumerRate | null | undefined,
  methods: PaymentMethodSummary[] | null | undefined,
): OfferedBuyRates | null {
  if (!rate || !methods) return null;
  const offers = (channel: PaymentMethodSummary["channel"]) =>
    methods.some((m) => m.channel === channel);
  return {
    bniTransfer: offers("BANK_TRANSFER") ? positiveRate(rate.bniTransferBuyRate) : null,
    gateway: offers("VA") ? positiveRate(rate.gatewayBuyRate) : null,
  };
}

function offeredList(rates: OfferedBuyRates | null): number[] {
  if (!rates) return [];
  return [rates.bniTransfer, rates.gateway].filter((r): r is number => r != null);
}

/**
 * The rate the form converts with: the cheapest offered buy rate. Null when no
 * method with a usable rate is offered.
 */
export function cheapestBuyRate(rates: OfferedBuyRates | null): number | null {
  const offered = offeredList(rates);
  return offered.length > 0 ? Math.min(...offered) : null;
}

const settle = (value: number) => Number(value.toFixed(2));

/**
 * The subtotal the rupiah minimum is judged on. Create rejects an order only
 * when NO offered method can pass (§4.3.4 — "perluasan pola channel termurah"),
 * and the subtotal of a method is USDX × its rate, so the highest offered rate
 * decides. Null when no method is offered or there is no amount.
 */
export function subtotalForMinimum(amountUsdx: number, rates: OfferedBuyRates | null): number | null {
  const offered = offeredList(rates);
  if (offered.length === 0 || !(amountUsdx > 0)) return null;
  return settle(amountUsdx * Math.max(...offered));
}
