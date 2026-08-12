// Client-visible runtime config (USDX-150, extended USDX-225). All vars are
// `NEXT_PUBLIC_*` so they inline into the client bundle at build time.
//
// - `apiBaseUrl`  — base URL of the real backend (`/api/v2/*`). Empty in local dev
//   until the backend is deployed; deploy targets (Netlify dev/staging/prod) set it.
// - `useMock`     — when true, the API layer routes to `mock-api.ts` instead of the
//   network. Explicit `NEXT_PUBLIC_USE_MOCK` wins; otherwise we mock whenever no
//   base URL is configured (keeps `pnpm dev` and the test suite working offline).
// - `checkoutUrl` — origin halaman checkout own-hosted (repo `checkout`,
//   `mint.usdx.co.id`). Setelah `POST /v2/mint`, app redirect ke
//   `${checkoutUrl}/checkout/{orderId}#code=<code>` — sesi di-handoff via **one-time
//   code** di URL hash (USDX-378, WSTG-CLNT-12; supersede cross-subdomain cookie
//   USDX-222 lalu bearer JWT `#token=` USDX-240). Default = domain prod (sesuai SOT
//   week2.md § Ringkasan); override per environment via `NEXT_PUBLIC_CHECKOUT_URL`
//   (mis. dev → checkout dev) agar E2E lintas-domain (USDX-226) bisa.
//
// Session transport is Bearer-token (matches back-office + openapi `bearerAuth`),
// chosen over cross-site cookies because FE (Netlify) and API (Railway) are
// different origins. See PR notes.

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const explicitMock = process.env.NEXT_PUBLIC_USE_MOCK;
const checkoutUrl = (
  process.env.NEXT_PUBLIC_CHECKOUT_URL ?? "https://mint.usdx.co.id"
).replace(/\/$/, "");

export const env = {
  apiBaseUrl,
  checkoutUrl,
  useMock:
    explicitMock === "true"
      ? true
      : explicitMock === "false"
        ? false
        : apiBaseUrl === "",
  // W3: the redeem burn is real on-chain, but the IDR payout (disbursement) is
  // still mocked even against the real backend (production is gated
  // REDEEM_DISABLED). Drives the "Mode simulasi" notice on the redeem tracker
  // regardless of `useMock`. Defaults on; set NEXT_PUBLIC_REDEEM_SIMULATED_PAYOUT
  // to "false" once a real disbursement provider ships (week3.md § Status rilis
  // W3 / § Status Tracker, USDX-263).
  redeemSimulatedPayout: process.env.NEXT_PUBLIC_REDEEM_SIMULATED_PAYOUT !== "false",
} as const;
