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
// Numeric EIP-155 id for the redeem chain — Polygon mainnet (137). The
// precondition gate enforces the connected wallet is on this network before the
// burn (week3.md § Week 3 Addendum, USDX-259); mismatch → prompt switch.
export const REDEEM_CHAIN_NUM_ID = 137;
// USDX token contract on Polygon — read on-chain for the balance precondition
// (balanceOf) and the target of the burn tx `redeem(redeemId, amountWei)`. Set
// NEXT_PUBLIC_USDX_CONTRACT_ADDRESS per environment to the deployed USDX proxy
// (must match the backend's `contractAddress`); the mock path (env.useMock) never
// reads this. (USDX-263)
export const USDX_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_USDX_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
// Below this native POL balance the burn likely can't pay gas — surface a
// non-blocking warning (week3.md § Precondition: "warning gas POL"). Heuristic
// only; the wallet enforces the real gas cost.
export const REDEEM_MIN_GAS_POL = 0.005;
// WalletConnect Cloud project id for RainbowKit (real wallet connect). The demo
// fallback keeps injected wallets + the offline test seam working; set a real id
// via NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in deployed environments. (USDX-263)
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "usdx-demo-project-id";
// Polygon RPC for on-chain reads (balanceOf) + the burn tx. Empty → wagmi's
// default public RPC (rate-limited, fine for dev). Set NEXT_PUBLIC_POLYGON_RPC_URL
// to a dedicated endpoint for reliable real reads. (USDX-263)
export const POLYGON_RPC_URL = process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "";

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
