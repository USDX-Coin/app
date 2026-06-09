// Client-visible runtime config (USDX-150). All vars are `NEXT_PUBLIC_*` so they
// inline into the client bundle at build time.
//
// - `apiBaseUrl`  — base URL of the real backend (`/api/v2/*`). Empty in local dev
//   until the backend is deployed; deploy targets (Netlify dev/staging/prod) set it.
// - `useMock`     — when true, the API layer routes to `mock-api.ts` instead of the
//   network. Explicit `NEXT_PUBLIC_USE_MOCK` wins; otherwise we mock whenever no
//   base URL is configured (keeps `pnpm dev` and the test suite working offline).
//
// Session transport is Bearer-token (matches back-office + openapi `bearerAuth`),
// chosen over cross-site cookies because FE (Netlify) and API (Railway) are
// different origins. See PR notes.

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const explicitMock = process.env.NEXT_PUBLIC_USE_MOCK;

export const env = {
  apiBaseUrl,
  useMock:
    explicitMock === "true"
      ? true
      : explicitMock === "false"
        ? false
        : apiBaseUrl === "",
} as const;
