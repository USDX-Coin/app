# USDX Stablecoin App

USD-backed stablecoin web app with minting and redeeming. Modeled after [IDRX](https://app.idrx.co).

## Quick Start

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # Production build
pnpm lint         # ESLint
pnpm test         # Unit tests (Vitest)
pnpm test:integration  # Integration tests (Playwright, production build)
pnpm test:e2e     # E2E tests (Playwright, production build)
```

Demo credentials: `demo@usdx.com` / `Demo1234`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | TailwindCSS v4 + shadcn/ui (New York) |
| Client State | Zustand 5 (persist to localStorage) |
| Server State | TanStack Query 5 |
| Wallet | RainbowKit 2 + Wagmi 2 + Viem 2 |
| Unit Tests | Vitest 4 + Testing Library |
| E2E/Integration | Playwright 1.58 |
| Package Manager | pnpm |

Brand color: `#1eaed5`

## Architecture

```
src/
  app/              # Next.js pages (App Router, Server Components)
    (auth)/         # Login, register, forgot-password (Server Components)
    (dashboard)/    # Mint, redeem, transactions, profile (SC pages + Client wrappers)
    payment/        # Standalone mock payment gateway (Client Component)
  components/
    auth/           # LoginForm, RegisterForm, ForgotPasswordForm (Client)
    shared/         # ChainSelector (cross-feature, memo-wrapped)
    layout/         # AuthLayout, Header, Sidebar, Logo
    mint/           # MintForm, MintReview, MintPageContent, skeletons
    redeem/         # RedeemForm, RedeemReview, RedeemPageContent, skeletons
    transactions/   # TransactionList, skeletons
    profile/        # ProfileCard, skeleton
    ui/             # shadcn/ui base components (auto-generated)
  hooks/            # Custom hooks (useAuth, useMint, useRedeem, etc.)
  stores/           # Zustand stores (authStore, mintStore, redeemStore)
  lib/              # Utilities, validations, constants, chains (7 EVM), mock API
  providers/
    Providers.tsx       # QueryClient + Toaster (lightweight, all pages)
    WalletProviders.tsx # RainbowKit + Wagmi (dashboard only)
  types/            # Shared TypeScript interfaces
tests/
  helpers/          # Shared test utilities (test-utils.tsx, playwright-utils.ts)
  unit/             # Vitest — business logic, hooks, stores, API
  integration/      # Playwright — page interactions + responsive viewports
  e2e/              # Playwright — full user flows
```

## State Flow

```
Zustand Store  →  Custom Hook  →  Component  →  Mock API
(client state)    (logic+calc)    (UI render)   (async ops)
```

- **Zustand**: form wizard state (step, chainId, amount), auth (user, token)
- **TanStack Query**: async data (transactions, wallet balance, mutations)
- **Hooks**: combine store + query + validation + calculations + useMemo

## Key Patterns

### Server Components
Pages are Server Components that render Client Component wrappers:
- Auth pages: `page.tsx` (SC) → `LoginForm` (CC)
- Dashboard pages: `page.tsx` (SC) → `MintPageContent` (CC)
- Dashboard layout stays `"use client"` (auth guard + mobile menu)

### Provider Architecture
- Root `Providers.tsx`: QueryClient + Toaster (all pages)
- `WalletProviders.tsx`: RainbowKit + Wagmi (dashboard layout only)
- Auth pages don't load wallet JavaScript (~250KB savings)

### Error Boundaries
Per-route `error.tsx` files in each dashboard route. Uses Next.js App Router convention with `reset()` callback.

### Skeleton Loading
Detailed skeleton components matching exact layout per feature. Used with conditional `isLoading` checks (not Suspense — `useQuery` doesn't suspend).

### Validation
All validators return `string | null` (error message or null for valid). Located in `src/lib/validations.ts`. EVM-only address validation (must start with `0x`). Hoisted regex at module level.

### Multi-Step Forms
Mint and Redeem use step-based state machines:
- Mint: `form` → `review` → `payment`
- Redeem: `form` → `review` → `executing` → `success`

Step state lives in Zustand stores. Form data preserved when going back.

### Mock API
All backend calls go through `src/lib/api/mock-api.ts` with simulated delays. Replace with real API client when backend is ready.

### Shared Components
- `ChainSelector` — `components/shared/` (React.memo-wrapped, used by Mint and Redeem)
- `validations.ts` — shared across all forms
- `chains.ts` — 7 EVM chains, Map-based O(1) lookups

### Re-render Optimization
- `React.memo` on ChainSelector
- `useMemo` for selectedChain in hooks, initials in Header
- Query invalidation after mint/redeem mutations
- Double-submission guard in executeRedeem

## Responsive Design

Breakpoint strategy (mobile-first):
- Default (< 768px): Single column, hamburger menu, card views
- `md` (768px+): Sidebar visible, table views, more padding
- `lg` (1024px+): Side-by-side form + review panels

## Testing

```
describe('functionOrPage') →
  describe('positive') → test('...')
  describe('negative') → test('...')
  describe('edge cases') → test('...')
```

- **Unit tests** (142): hooks, stores, API, validations, utils, chains
- **Integration tests** (43): page interactions + responsive (mobile/tablet/desktop)
- **E2E tests** (11): auth flow, mint flow, redeem flow, payment flow

Test helpers in `tests/helpers/`:
- `test-utils.tsx`: QueryClient wrapper for renderHook
- `playwright-utils.ts`: loginViaStorage, clearAuth, VIEWPORTS

## Route Structure

| Route | Auth | Type | Description |
|-------|------|------|-------------|
| `/login` | No | SC | Email/password login |
| `/register` | No | SC | Create account |
| `/forgot-password` | No | SC | Password reset |
| `/mint` | Yes | SC | Mint USDX (default dashboard) |
| `/redeem` | Yes | SC | Redeem USDX to bank |
| `/transactions` | Yes | SC | Transaction history |
| `/profile` | Yes | SC | User info + verification badge |
| `/payment` | No* | CC | Mock payment gateway (*redirects to /mint without data) |

## Known Limitations

- All API calls are mocked (no real backend)
- Smart contract interactions are simulated
- RainbowKit wallet connection works but balance is mocked
- WalletConnect SSR produces `indexedDB` warnings (harmless)
- KYC verification is UI-only (always shows "Verified")
- Solana removed — EVM chains only (7 chains)
- Validation messages (`validations.ts`) are English-only — they appear untranslated in the ID locale (UI chrome is i18n'd EN+ID, validation strings are not)


# Source of Truth

Folder `sot/` contains the project spec. Read before coding. Never edit `sot/`.

**If spec is unclear — ask the PM, don't assume.**

## Key files for this repo:

- `sot/phase-2/week1.md` — **AKTIF (Week 1)**: auth flow (register/verify/login/forgot password), KYC INDIVIDUAL flow, FE deliverables, error codes per endpoint
- `sot/phase-2/phase2.md` — Phase 2 overview: pages roadmap, mint/redeem/bridge flows (W2+)
- `sot/conventions.md` — API response format, naming conventions, status enums
- `sot/api/openapi.yaml` — API contract entry point (consumer endpoints `/api/v2/*`: `auth.yaml`, `kyc.yaml`, `storage.yaml`)

## Critical rules:

- **App SUDAH ADA — jangan scaffold ulang.** Next.js App Router + Tailwind v4 + shadcn/ui, UI mock sudah sesuai Figma. Scope Week 1 = ganti mock dengan real API + tambah halaman yang belum ada (lihat `sot/phase-2/week1.md` § Deliverables Week 1)
- Ganti `src/lib/api/mock-api.ts` **bertahap** dengan real API client (`NEXT_PUBLIC_API_BASE_URL` → `/api/v2/*`) — jangan rewrite sekaligus
- API responses follow `{ status, metadata, data, error }` format — see `sot/conventions.md`
- Auth: Better Auth client **consumer audience** (session 30 hari sliding) — bukan audience backoffice
- Error handling konsisten: 401 → clear session + redirect `/login`; 403 `EMAIL_NOT_VERIFIED` → banner verifikasi + tombol resend; 403 `KYC_NOT_VERIFIED` → lock CTA + arahkan ke `/kyc`; 429 → cooldown countdown
- KYC upload via presigned URL: `POST /v2/storage/presigned-upload` → PUT file langsung ke bucket → `POST /v2/kyc` dengan objectKeys (lihat `sot/phase-2/week1.md` § Consumer App Flow)
- KYC status enums: `UNVERIFIED | PENDING | VERIFIED | REJECTED` — CTA mint/redeem/bridge terkunci kalau bukan `VERIFIED`
- SOT is authoritative — if your implementation differs from SOT, your code adjusts (not SOT)

## PR Description

Saat buat PR, generate description mengikuti format di `sot/templates/pr-template.md`. Ini wajib — PM review berdasarkan structure ini.

Key points:
- Selalu include "PM Action Items" section (bisa "None")
- Selalu include "SoT Alignment" table — cross-check setiap field/endpoint vs SOT
- Jika implement sesuatu yang TIDAK ada di SOT → masukkan ke "Known Drift > Needs PM Action" dengan category ❓ Decision
- Jika ada AC yang belum bisa dicapai → mark ⏳ Deferred dengan reason
- Jika ada action yang harus dilakukan SETELAH merge → masukkan "Post-Merge Actions"
