export const EXCHANGE_RATE = 1; // 1 USDX = 1 USD
export const MIN_MINT_AMOUNT = 10;
export const MAX_MINT_AMOUNT = 1_000_000;
export const MIN_REDEEM_AMOUNT = 10;
export const MAX_REDEEM_AMOUNT = 1_000_000;
export const MINTING_FEE_PERCENT = 0.007; // 0.7%
export const USD_TO_IDR_RATE = 17_010; // IDR per 1 USD (mirrors back-office mock rate)
// Phase 2 = Polygon-only consumer mint (week2.md § Week 2 Decisions, Chain).
// FE sends `chain="polygon"` hardcoded; there is no /api/v2/chains.
export const MINT_CHAIN_ID = "polygon";
// Redeem is Polygon-only too (week3.md § Chain). Hardcoded in the create request;
// there's no chain picker in the redeem form.
export const REDEEM_CHAIN_ID = "polygon";

// Redeem fee config (week3.md § Fee & Spread). These mirror the backend
// `fee_configs` so the form can preview "Anda akan terima" (net payout) before
// the order is created; the POST /v2/redeem response stays authoritative. Real
// values come from the backend at INT-1 (USDX-249).
export const REDEEM_FEE_PCT = 1.0; // % of gross IDR
export const DISBURSEMENT_FEE_FLAT_IDR = 5_000; // flat IDR per payout (provider service fee)
// Minimum net payout — Asasta bills floor (week3.md § Min payout). Checked from
// create: net below this is rejected before the user burns.
export const MIN_REDEEM_PAYOUT_IDR = 10_000;
// USDX has 6 on-chain decimals (amount "100" → amountWei "100000000").
export const USDX_DECIMALS = 6;

export const BRAND_COLOR = "#800000";
export const APP_NAME = "USDX";
