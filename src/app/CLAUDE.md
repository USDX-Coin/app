# src/app — Next.js App Router Pages

## Route Groups

- `(auth)/` — Unauthenticated pages (login, register, forgot-password). Uses `AuthLayout` (split screen).
- `(dashboard)/` — Authenticated pages (mint, redeem, transactions, profile, settings, `onboarding/wallet`). Uses dashboard layout (sidebar + header). Redirects to `/login` if not authenticated. `onboarding/wallet` is the optional "dikasih wallet" step verify-email lands on for a new account (USDX-566) — it sits in this group because the wallet POST needs a session and the sidebar balance card fills in as soon as the wallet is ACTIVE.

## Auth Guard

`(dashboard)/layout.tsx` checks `useAuthStore().isAuthenticated` after Zustand hydration. Shows a loading spinner during hydration, then redirects to `/login` if not authenticated.

## Adding a New Page

1. Create folder in appropriate route group: `src/app/(dashboard)/newpage/page.tsx`
2. Export default function component
3. Add `"use client"` if it uses hooks/state
4. Add navigation link in `src/components/layout/Sidebar.tsx`

## Root Layout

`layout.tsx` wraps everything with `<Providers>` (ThemeProvider, LanguageProvider,
QueryClient, `ApiClientBridge`, Toaster). Wallet libs (Wagmi/RainbowKit) are **not**
loaded at the root — `WalletProviders` is dashboard-only and dynamically imported
(`ssr: false`). Since USDX-396 it wraps the **whole dashboard shell**, not just the
page content, because the sidebar balance card reads the connected wallet on-chain.
There is still **no global connect-wallet button**: connect stays contextual (the
redeem form, the sidebar balance card, the Send/Bridge balance row).

## Home Page

`page.tsx` redirects to `/login` via client-side `router.replace`.
