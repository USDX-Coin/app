// Redeem fee breakdown (week3.md § Fee & Spread). Pure + shared so the form
// preview (useRedeem) and the mock create (mock-api) compute identically — the
// POST /v2/redeem response stays authoritative either way.
//
// gross_idr = amount_usdx × effective_sell_rate (sale value before fee)
// redeem_fee_idr = redeem_fee_pct/100 × gross_idr
// disbursement_fee_idr = flat (provider service fee)
// net_payout_idr = floor(gross − total_fee)  ← user receives, must be ≥ Rp 10.000
//
// Fees are *subtracted* from gross (the opposite of mint, which adds on top).

import type { AmountCurrency } from "@/types";

export interface RedeemBreakdownInput {
  amount: number; // raw amount the user typed
  amountCurrency: AmountCurrency; // USD = USDX amount; IDR = gross_idr (sale value)
  effectiveSellRate: number; // baseRate × (1 − spreadSellPct/100)
  redeemFeePct: number;
  disbursementFeeFlatIdr: number;
}

export interface RedeemBreakdown {
  amountUsdx: number;
  grossIdr: number;
  redeemFeeIdr: number;
  disbursementFeeIdr: number;
  totalFeeIdr: number;
  netPayoutIdr: number; // floored to whole rupiah
}

const ZERO: RedeemBreakdown = {
  amountUsdx: 0,
  grossIdr: 0,
  redeemFeeIdr: 0,
  disbursementFeeIdr: 0,
  totalFeeIdr: 0,
  netPayoutIdr: 0,
};

export function computeRedeemBreakdown(input: RedeemBreakdownInput): RedeemBreakdown {
  const { amount, amountCurrency, effectiveSellRate, redeemFeePct, disbursementFeeFlatIdr } = input;
  if (!(amount > 0) || !(effectiveSellRate > 0)) return ZERO;

  const amountUsdx = amountCurrency === "USD" ? amount : amount / effectiveSellRate;
  const grossIdr = amountCurrency === "IDR" ? amount : amountUsdx * effectiveSellRate;
  const redeemFeeIdr = (redeemFeePct / 100) * grossIdr;
  const disbursementFeeIdr = disbursementFeeFlatIdr;
  const totalFeeIdr = redeemFeeIdr + disbursementFeeIdr;
  // Net is floored to whole rupiah (week3.md: "desimal dibulatkan ke bawah"),
  // clamped at 0 so a fee-heavy tiny amount never previews a negative payout.
  const netPayoutIdr = Math.max(0, Math.floor(grossIdr - totalFeeIdr));

  return { amountUsdx, grossIdr, redeemFeeIdr, disbursementFeeIdr, totalFeeIdr, netPayoutIdr };
}
