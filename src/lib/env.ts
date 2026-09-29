// Client-visible runtime config (USDX-150, extended USDX-225). All vars are
// `NEXT_PUBLIC_*` so they inline into the client bundle at build time.
//
// - `apiBaseUrl`  — base URL of the real backend (`/api/v2/*`). Empty in local dev
//   until the backend is deployed; tiap deploy target (dev/prod) menyuntiknya saat build.
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
// - `walletCreateEnabled` — sakelar tombol "Buatkan saya wallet" (custodial-wallet.md
//   §1, amandemen 21 Sep 2026, USDX-699). Tombol hanya tampil di build DEV; prod tetap
//   pill "Segera hadir" (hotfix USDX-684) sampai wallet-service prod hidup. Nilai
//   eksplisit `NEXT_PUBLIC_WALLET_CREATE_ENABLED` ("true"/"false") menang; tanpa itu
//   menyala HANYA di mode mock (lokal/test) atau bila API = `WALLET_CREATE_DEV_API`.
//   Daftar-izin, bukan daftar-tolak: URL lain apa pun — prod, atau yang belum dikenal
//   — berarti MATI (gagal tertutup), jadi salah konfigurasi tidak pernah membuka
//   tombol yang pasti 503 di depan user nyata.
//
// Session transport is Bearer-token (matches back-office + openapi `bearerAuth`),
// chosen over cross-site cookies because the FE and the API are different origins.
// See PR notes.

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const explicitMock = process.env.NEXT_PUBLIC_USE_MOCK;
const checkoutUrl = (
  process.env.NEXT_PUBLIC_CHECKOUT_URL ?? "https://mint.usdx.co.id"
).replace(/\/$/, "");

const useMock =
  explicitMock === "true" ? true : explicitMock === "false" ? false : apiBaseUrl === "";

/** Satu-satunya backend tempat membuat wallet custodial boleh ditawarkan tanpa flag eksplisit. */
export const WALLET_CREATE_DEV_API = "https://api-dev.usdx.co.id";

// Diekspor supaya tabel kebenarannya bisa diuji tanpa memuat ulang modul
// (`NEXT_PUBLIC_*` di-inline saat build).
export function resolveWalletCreateEnabled(input: {
  explicit: string | undefined;
  useMock: boolean;
  apiBaseUrl: string;
}): boolean {
  if (input.explicit === "true") return true;
  if (input.explicit === "false") return false;
  return input.useMock || input.apiBaseUrl === WALLET_CREATE_DEV_API;
}

export const env = {
  apiBaseUrl,
  checkoutUrl,
  useMock,
  walletCreateEnabled: resolveWalletCreateEnabled({
    explicit: process.env.NEXT_PUBLIC_WALLET_CREATE_ENABLED,
    useMock,
    apiBaseUrl,
  }),
} as const;
