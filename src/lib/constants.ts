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
// VA banks supported by the provider (common.yaml VaBank). Used as the static
// fallback for the checkout method selector when GET /v2/mint/{id} doesn't
// return channels[] (e.g. after a refresh — see MintOrderDetail.channels).
export const VA_BANKS = [
  "BCA", "BNI", "BRI", "CIMB", "DANAMON", "INA", "MANDIRI", "PERMATA", "MAYBANK",
] as const;

// Per-bank brand styling for the checkout method picker (USDX-202). `logo` points
// to the official bank logo SVG (under public/image/banks/) rendered on a white
// tile; `mark`/`bg`/`fg` are the wordmark fallback for banks without a logo asset
// (e.g. Bank INA). Logos are used as payment-method identifiers (functional/
// nominative use) — confirm brand-kit rights before production.
export const BANK_BRAND: Record<
  (typeof VA_BANKS)[number],
  { bg: string; fg: string; mark: string; logo?: string }
> = {
  BCA: { bg: "#0066AE", fg: "#ffffff", mark: "BCA", logo: "/image/banks/bca.svg" },
  BNI: { bg: "#EE7203", fg: "#ffffff", mark: "BNI", logo: "/image/banks/bni.svg" },
  BRI: { bg: "#00529C", fg: "#ffffff", mark: "BRI", logo: "/image/banks/bri.svg" },
  CIMB: { bg: "#7A0C2E", fg: "#ffffff", mark: "CIMB", logo: "/image/banks/cimb.svg" },
  DANAMON: { bg: "#005EB8", fg: "#ffffff", mark: "DNM", logo: "/image/banks/danamon.svg" },
  INA: { bg: "#0E7C7B", fg: "#ffffff", mark: "INA", logo: "/image/banks/ina.png" },
  MANDIRI: { bg: "#003D79", fg: "#ffffff", mark: "MDR", logo: "/image/banks/mandiri.svg" },
  PERMATA: { bg: "#00945E", fg: "#ffffff", mark: "PRM", logo: "/image/banks/permata.svg" },
  MAYBANK: { bg: "#FFC400", fg: "#1A1A1A", mark: "MBK", logo: "/image/banks/maybank.svg" },
};

// QRIS brand red for the QRIS channel badge / instruction card.
export const QRIS_RED = "#D2232A";

export const BRAND_COLOR = "#800000";
export const APP_NAME = "USDX";
