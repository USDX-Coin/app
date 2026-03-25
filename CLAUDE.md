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
  app/              # Next.js pages (App Router route groups)
  components/       # React components (layout/, mint/, redeem/, ui/)
  hooks/            # Custom hooks (useAuth, useMint, useRedeem, etc.)
  stores/           # Zustand stores (authStore, mintStore, redeemStore)
  lib/              # Utilities, validations, constants, chains, mock API
  providers/        # Root provider stack (Wagmi, QueryClient, RainbowKit)
  types/            # Shared TypeScript interfaces
tests/
  unit/             # Vitest — business logic only, all data mocked
  integration/      # Playwright — page interactions, production build
  e2e/              # Playwright — full user flows, production build
```

## State Flow

```
Zustand Store  →  Custom Hook  →  Component  →  Mock API
(client state)    (logic+calc)    (UI render)   (async ops)
```

- **Zustand**: form wizard state (step, chainId, amount), auth (user, token)
- **TanStack Query**: async data (transactions, wallet balance, mutations)
- **Hooks**: combine store + query + validation + calculations

## Key Patterns

### Validation
All validators return `string | null` (error message or null for valid). Located in `src/lib/validations.ts`. Used in hooks, not directly in components.

### Multi-Step Forms
Mint and Redeem use step-based state machines:
- Mint: `form` → `review` → `payment`
- Redeem: `form` → `review` → `executing` → `success`

Step state lives in Zustand stores. Form data preserved when going back.

### Mock API
All backend calls go through `src/lib/api/mock-api.ts` with simulated delays. Replace with real API client when backend is ready. Request/response types in `src/lib/api/types.ts`.

### Shared Components
- `ChainSelector` — used by both Mint and Redeem (lives in `components/mint/`)
- `validations.ts` — shared across all forms
- `utils.ts` — formatAmount, truncateAddress, parseAmount used everywhere
- `chains.ts` — single source of truth for supported chains

## Testing Convention

```
describe('functionOrPage') →
  describe('positive') → test('...')
  describe('negative') → test('...')
  describe('edge cases') → test('...')
```

- **Unit tests**: pure business logic, all data mocked, fast (<2s)
- **Integration tests**: Playwright against production build, auth via localStorage injection
- **E2E tests**: full user flows (register → login → mint → payment)

## Route Structure

| Route | Auth | Description |
|-------|------|-------------|
| `/login` | No | Email/password login |
| `/register` | No | Create account |
| `/forgot-password` | No | Password reset |
| `/mint` | Yes | Mint USDX (default dashboard) |
| `/redeem` | Yes | Redeem USDX to bank |
| `/transactions` | Yes | Transaction history |
| `/profile` | Yes | User info + KYC badge |
| `/payment` | No | Mock payment gateway |

## Known Limitations

- All API calls are mocked (no real backend)
- Smart contract interactions are simulated
- RainbowKit wallet connection works but balance is mocked
- WalletConnect SSR produces `indexedDB` warnings (harmless)
- KYC verification is UI-only (always shows "Verified")
