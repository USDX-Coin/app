# USDX Stablecoin App

A USD-backed stablecoin web application for minting and redeeming USDX tokens across multiple EVM chains. Built with Next.js 15, TypeScript, and RainbowKit.

## Features

- **Mint USDX** — Convert USD to USDX tokens on 7 supported EVM chains
- **Redeem USDX** — Redeem tokens back to USD via bank transfer
- **Transaction History** — View all mint and redeem transactions with status tracking
- **Multi-Chain Support** — Base, Polygon, BSC, Lisk, Etherlink, Kaia, Monad
- **Wallet Connection** — RainbowKit integration for wallet management
- **Responsive Design** — Optimized for mobile, tablet, and desktop

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo credentials:** `demo@usdx.com` / `Demo1234`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Server Components) |
| Language | TypeScript (strict mode) |
| Styling | TailwindCSS v4 + shadcn/ui (New York) |
| Client State | Zustand 5 |
| Server State | TanStack Query 5 |
| Wallet | RainbowKit 2 + Wagmi 2 + Viem 2 |
| Testing | Vitest + Playwright |
| Package Manager | pnpm |

## Architecture

```
Zustand Store → Custom Hook → Component → Mock API
```

- **Pages** are Server Components rendering Client Component wrappers
- **Providers** are split: lightweight (all pages) vs wallet (dashboard only)
- **Error boundaries** per route via Next.js `error.tsx`
- **Skeleton loading** components matching exact layout

## Development

```bash
pnpm dev              # Development server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm test             # Unit tests (Vitest, 142 tests)
pnpm test:integration # Integration tests (Playwright, 43 tests)
pnpm test:e2e         # E2E tests (Playwright, 11 tests)
```

## Project Structure

```
src/
  app/           # Next.js App Router (Server Components)
  components/    # React components (auth, shared, layout, features, ui)
  hooks/         # Custom hooks (useAuth, useMint, useRedeem)
  stores/        # Zustand stores (auth, mint, redeem)
  lib/           # Utilities, validations, chains, mock API
  providers/     # Provider stack (QueryClient, Wallet)
tests/
  unit/          # Business logic tests
  integration/   # Page interaction + responsive tests
  e2e/           # Full user flow tests
```

## License

Private
