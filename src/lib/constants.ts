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

export const BRAND_COLOR = "#800000";
export const APP_NAME = "USDX";
