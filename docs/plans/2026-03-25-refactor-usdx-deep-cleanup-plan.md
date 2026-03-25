---
title: "refactor: USDX Deep Cleanup — Folder Structure, Best Practices, Testing, Responsive, Docs"
type: refactor
status: active
date: 2026-03-25
origin: docs/brainstorms/2026-03-25-project-cleanup-brainstorm.md
---

# refactor: USDX Deep Cleanup

## Overview

Deep refactoring of the USDX stablecoin app covering: folder restructure, Vercel React best practices (Server Components, bundle optimization, re-render fixes), per-feature error boundaries, responsive design (4 viewports), comprehensive testing (unit + integration + e2e), and documentation updates. All decisions resolved in brainstorm (see brainstorm: `docs/brainstorms/2026-03-25-project-cleanup-brainstorm.md`).

## Problem Statement

The codebase has solid fundamentals (clean separation, strict TypeScript, good state flow) but accumulated technical debt across 10 areas:

| Area | Current Score | Issues |
|------|--------------|--------|
| Folder Structure | 7/10 | ChainSelector misplaced, empty folders, no shared/ |
| Server Components | 2/10 | Every page is `"use client"`, zero SC |
| Bundle Size | 4/10 | RainbowKit+Wagmi (~250KB) loaded on auth pages |
| Data Fetching | 5/10 | 3 waterfall patterns, no query invalidation |
| Re-renders | 3/10 | Zero memo/useCallback, 15+ inline functions |
| Error Handling | 1/10 | Zero error boundaries, no error.tsx files |
| Responsive | 5/10 | Missing md breakpoint, forms not responsive |
| Test Coverage | 5/10 | No hook tests, no API tests, no responsive tests |
| Documentation | 4/10 | README empty, CLAUDE.md outdated |
| Architecture | 6/10 | Chain mismatch, Solana in EVM-only stack, derived state |

## Resolved Decisions

All decisions from brainstorm, plus SpecFlow gap resolutions:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Payment page | Keep standalone | User decision |
| Error boundaries | Next.js `error.tsx` per route | Idiomatic App Router, auto-reset on navigation (SpecFlow Gap 9) |
| Chain config | Remove Solana, add 3 EVM chains | Simplify: all chains EVM-compatible (see brainstorm) |
| Loading states | Conditional `isLoading` + skeleton components | `useSuspenseQuery` too risky for refactor scope (SpecFlow Gap 3) |
| Solana removal | Remove from SUPPORTED_CHAINS + validations | 8 → 7 chains, EVM-only (see brainstorm) |
| Hook testing | `renderHook` + real Zustand + mocked router | Realistic testing (see brainstorm) |
| MSW | **Skip MSW, use Playwright `page.route()`** | App makes zero HTTP requests — MSW has nothing to intercept (SpecFlow Gap 15-16) |
| Responsive viewports | 4: 320, 375, 768, 1280 | Comprehensive coverage (see brainstorm) |
| Skeleton granularity | Detailed + responsive | Match component layout AND responsive breakpoints (SpecFlow Gap 28) |
| Sidebar breakpoint | `md` for sidebar, `lg` for side-by-side forms | Prevent layout collision at 768px (SpecFlow Gap 20) |
| Payment page guard | Redirect to /mint if no data | Fix real user bug — refresh loses state (SpecFlow Gap 11) |
| validateAddress post-Solana | "Address must start with 0x" | Clear EVM-only messaging (SpecFlow Gap 5) |
| Chain IDs | etherlink: 42793, kaia: 8217, monad: 10143 (testnet) | Confirmed chain IDs (SpecFlow Gap 31) |
| Suspense boundaries | Only for `next/dynamic` lazy loads | Not for data fetching — `useQuery` doesn't suspend (SpecFlow Gap 3) |
| Mock Solana tx | Change tx_5 chainId to "polygon" | Fix undefined chain name (SpecFlow Gap 4) |
| Double-submission | Add guard in executeRedeem hook | Prevent double financial transactions (SpecFlow Gap 24) |

## Technical Approach

### Architecture Changes

```
BEFORE:
Root Layout → Providers (Wagmi+RainbowKit+QueryClient+Toaster)
  → All pages "use client"
  → No error handling
  → No skeletons

AFTER:
Root Layout → Providers (QueryClient+Toaster only)
  → (auth)/ pages as Server Components
    → Client Components extracted to components/auth/
  → (dashboard)/ layout → WalletProviders (Wagmi+RainbowKit)
    → Pages as Server Components with error.tsx
    → Client feature components with skeletons
  → payment/ stays client (with data guard)
```

### New Folder Structure

```
src/
  app/
    (auth)/
      layout.tsx              # Server Component (remove "use client")
      login/
        page.tsx              # Server Component → renders <LoginForm />
      register/
        page.tsx              # Server Component → renders <RegisterForm />
      forgot-password/
        page.tsx              # Server Component → renders <ForgotPasswordForm />
    (dashboard)/
      layout.tsx              # Client Component (auth guard + sidebar + WalletProviders)
      error.tsx               # NEW: dashboard-level error boundary
      mint/
        page.tsx              # Server Component → renders <MintPageContent />
        error.tsx             # NEW: mint error boundary
      redeem/
        page.tsx              # Server Component → renders <RedeemPageContent />
        error.tsx             # NEW: redeem error boundary
      transactions/
        page.tsx              # Server Component → renders <TransactionPageContent />
        error.tsx             # NEW: transactions error boundary
      profile/
        page.tsx              # Server Component → renders <ProfilePageContent />
        error.tsx             # NEW: profile error boundary
    payment/
      page.tsx                # Client Component (keep, add data guard)
    layout.tsx                # Root layout (Providers without wallet)
    globals.css
  components/
    shared/                   # NEW
      ChainSelector.tsx       # Moved from mint/
    auth/                     # NEW: extracted from pages
      LoginForm.tsx
      RegisterForm.tsx
      ForgotPasswordForm.tsx
    layout/
      AuthLayout.tsx
      Header.tsx
      Sidebar.tsx
      Logo.tsx
    mint/
      MintForm.tsx
      MintReview.tsx
      MintPageContent.tsx     # NEW: client wrapper for mint page
      MintFormSkeleton.tsx    # NEW
      MintReviewSkeleton.tsx  # NEW
    redeem/
      RedeemForm.tsx
      RedeemReview.tsx
      RedeemPageContent.tsx   # NEW: client wrapper
      RedeemFormSkeleton.tsx  # NEW
      RedeemReviewSkeleton.tsx # NEW
      BankAccountSelector.tsx
      BankAccountSelectorSkeleton.tsx # NEW
    transactions/
      TransactionList.tsx     # NEW: extracted from page
      TransactionListSkeleton.tsx # NEW
      TransactionCardSkeleton.tsx # NEW
    profile/
      ProfileCard.tsx         # NEW: extracted from page
      ProfileCardSkeleton.tsx # NEW
    ui/                       # No change (shadcn)
  hooks/                      # Existing + fixes
  stores/                     # Existing + derived isAuthenticated
  lib/
    api/                      # Fix mock Solana tx
    chains.ts                 # Remove Solana (8 → 7)
    validations.ts            # EVM-only address validation
    utils.ts                  # No change
    constants.ts              # No change
  providers/
    Providers.tsx             # Lightweight: QueryClient + Toaster
    WalletProviders.tsx       # NEW: RainbowKit + Wagmi (dashboard only)
  types/                      # No change
tests/
  setup.ts
  helpers/
    test-utils.tsx            # NEW: renderHook wrapper, store reset
    playwright-utils.ts       # NEW: shared helpers (auth, viewports)
  unit/
    lib/
      validations.test.ts     # Expand
      utils.test.ts           # Expand
      chains.test.ts          # NEW
    api/
      mock-api.test.ts        # NEW
    stores/                   # Expand existing
    hooks/
      useAuth.test.tsx        # NEW
      useMint.test.tsx        # NEW
      useRedeem.test.tsx      # NEW
      useChainSelector.test.ts # NEW
      useWalletBalance.test.tsx # NEW
      useTransactions.test.tsx # NEW
  integration/
    auth/
      login.spec.ts           # Expand
      register.spec.ts        # Expand
    dashboard/
      mint.spec.ts            # Expand
      redeem.spec.ts          # NEW
      transactions.spec.ts    # Expand
      profile.spec.ts         # Expand
    payment/
      payment.spec.ts         # NEW
    responsive/
      small-mobile.spec.ts    # NEW (320x568)
      mobile.spec.ts          # NEW (375x667)
      tablet.spec.ts          # NEW (768x1024)
      desktop.spec.ts         # NEW (1280x720)
  e2e/
    auth-flow.spec.ts         # Expand
    mint-flow.spec.ts         # Expand
    redeem-flow.spec.ts       # Expand
    payment-flow.spec.ts      # NEW
    responsive-flow.spec.ts   # NEW
```

### Implementation Phases

Each phase produces 1+ small commits. Every phase ends with all existing tests passing (green baseline).

---

#### Phase 1: Pre-Refactor Baseline + Payment Guard

**Goal:** Establish green baseline and fix the most critical user-facing bug.

**Commits:**

**Commit 1.1: Run existing tests, capture baseline**
```bash
pnpm test && pnpm test:integration && pnpm test:e2e
```
- Verify all tests pass
- Fix any flaky tests before proceeding

**Commit 1.2: Add payment page data guard**
- `src/app/payment/page.tsx` — Add check: if `amount` is empty/zero, redirect to `/mint`
- Prevents broken payment page on refresh (SpecFlow Gap 11)

**Commit 1.3: Fix duplicate import in payment page**
- `src/app/payment/page.tsx` — Merge duplicate `import { formatAmount, truncateAddress } from "@/lib/utils"` and `import { parseAmount } from "@/lib/utils"` into single import

**Verify:** Run tests, verify payment redirect works via agent-browser.

---

#### Phase 2: Folder Structure Cleanup

**Goal:** Move files to correct locations, create new directories, update imports. Zero behavior change.

**Commits:**

**Commit 2.1: Create shared/ and move ChainSelector**
- Create `src/components/shared/`
- Move `src/components/mint/ChainSelector.tsx` → `src/components/shared/ChainSelector.tsx`
- Update imports in:
  - `src/components/mint/MintForm.tsx`: `@/components/mint/ChainSelector` → `@/components/shared/ChainSelector`
  - `src/components/redeem/RedeemForm.tsx`: same change

**Commit 2.2: Remove empty folders**
- Delete empty `src/components/profile/` (if empty)
- Delete empty `src/components/transactions/` (if empty)
- Delete empty `tests/unit/hooks/` directory
- Delete empty `tests/integration/mocks/` directory

**Commit 2.3: Create test helpers**
- Create `tests/helpers/test-utils.tsx`:
  ```typescript
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { renderHook } from "@testing-library/react";
  import type { ReactNode } from "react";

  export function createTestQueryClient() {
    return new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  }

  export function createWrapper() {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  }

  export { renderHook } from "@testing-library/react";
  ```
- Create `tests/helpers/playwright-utils.ts`:
  ```typescript
  import type { Page } from "@playwright/test";

  const AUTH_STATE = {
    state: {
      user: {
        id: "usr_1", fullName: "Demo User", email: "demo@usdx.com",
        isVerified: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
      token: "mock-jwt-token-usr_1",
      isAuthenticated: true,
    },
    version: 0,
  };

  export async function loginViaStorage(page: Page) {
    await page.goto("/login");
    await page.evaluate((auth) => {
      localStorage.setItem("usdx-auth", JSON.stringify(auth));
    }, AUTH_STATE);
  }

  export async function clearAuth(page: Page) {
    await page.evaluate(() => localStorage.removeItem("usdx-auth"));
  }

  export const VIEWPORTS = {
    smallMobile: { width: 320, height: 568 },
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 720 },
  } as const;
  ```

**Commit 2.4: Deduplicate test helpers in existing tests**
- Update `tests/integration/login.spec.ts` — import `loginViaStorage`, `clearAuth` from `../helpers/playwright-utils`
- Update `tests/integration/register.spec.ts` — same
- Update `tests/integration/mint.spec.ts` — same
- Update `tests/integration/transactions.spec.ts` — same
- Update `tests/integration/profile.spec.ts` — same
- Update `tests/e2e/auth-flow.spec.ts` — import shared helpers
- Update `tests/e2e/mint-flow.spec.ts` — same
- Update `tests/e2e/redeem-flow.spec.ts` — same
- Remove duplicated `loginViaStorage()` and `login()` functions from each file

**Verify:** All tests still pass with shared helpers.

---

#### Phase 3: Provider Splitting + Bundle Optimization

**Goal:** Auth pages load ~250KB less JavaScript. Must happen BEFORE chain config changes so custom chains go directly into WalletProviders.

**Commits:**

**Commit 3.1: Create WalletProviders.tsx**
- Create `src/providers/WalletProviders.tsx`:
  ```typescript
  "use client";
  import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
  import "@rainbow-me/rainbowkit/styles.css";
  import { WagmiProvider } from "wagmi";
  import { base, bsc, polygon, lisk } from "wagmi/chains";
  // QueryClient comes from parent Providers, no duplication

  const config = getDefaultConfig({ ... });

  export function WalletProviders({ children }: { children: React.ReactNode }) {
    return (
      <WagmiProvider config={config}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </WagmiProvider>
    );
  }
  ```

**Commit 3.2: Slim down root Providers.tsx**
- `src/providers/Providers.tsx` — Remove Wagmi/RainbowKit imports and config. Keep only:
  - `QueryClientProvider` (move QueryClient to `useState` to fix SSR leak)
  - `Toaster`
- **IMPORTANT:** `QueryClientProvider` must stay in root Providers — auth pages use `useMutation` for login/register

**Commit 3.3: Integrate WalletProviders in dashboard layout**
- `src/app/(dashboard)/layout.tsx` — Import and wrap children with `<WalletProviders>`
- Only dashboard pages load wallet code now

**Verify:** Agent-browser: login page loads without wallet JS. Dashboard still has wallet connection. All tests pass.

---

#### Phase 4: Chain Config — Remove Solana, Add 3 EVM Chains

**Goal:** Align chains.ts with Wagmi config. All chains EVM-compatible.

**Commits:**

**Commit 4.1: Remove Solana from chains.ts**
- `src/lib/chains.ts` — Remove Solana entry from `SUPPORTED_CHAINS` (8 → 7 chains)
- `src/lib/validations.ts` — Simplify `validateAddress`: remove Solana branch, return `"Address must start with 0x"` for non-0x addresses
- `src/lib/api/mock-api.ts` — Change `tx_5.chainId` from `"solana"` to `"polygon"`

**Commit 4.2: Add 3 custom EVM chains to WalletProviders**
- `src/providers/WalletProviders.tsx` — Add custom chain definitions (directly in the right file, no redundant moves):
  ```typescript
  import { defineChain } from "viem";

  const etherlink = defineChain({
    id: 42793,
    name: "Etherlink",
    nativeCurrency: { name: "XTZ", symbol: "XTZ", decimals: 18 },
    rpcUrls: { default: { http: ["https://node.mainnet.etherlink.com"] } },
  });

  const kaia = defineChain({
    id: 8217,
    name: "Kaia",
    nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
    rpcUrls: { default: { http: ["https://public-en.node.kaia.io"] } },
  });

  const monad = defineChain({
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
    testnet: true,
  });
  ```
- Update Wagmi config to include all 7 chains: `base, lisk, bsc, polygon, etherlink, kaia, monad`

**Commit 4.3: Update existing chain-related tests**
- `tests/unit/validations.test.ts` — Remove Solana address tests, add test for non-0x rejection
- Verify chains count references in tests match 7

**Verify:** All tests pass. Agent-browser: verify chain selector shows 7 chains.

---

#### Phase 5: Server Component Conversion

**Goal:** Pages become Server Components. Interactive logic extracted to Client Components.

**Commits:**

**Commit 5.1: Extract auth forms**
- Create `src/components/auth/LoginForm.tsx` — Move form JSX + `useAuth` hook from login page
- Create `src/components/auth/RegisterForm.tsx` — Move form JSX + `useAuth` hook from register page
- Create `src/components/auth/ForgotPasswordForm.tsx` — Move form JSX from forgot-password page

**Commit 5.2: Convert auth pages to Server Components**
- `src/app/(auth)/layout.tsx` — Remove `"use client"`, keep as Server Component wrapping `<AuthLayout>`
- `src/app/(auth)/login/page.tsx` — Remove `"use client"`, render `<LoginForm />`
- `src/app/(auth)/register/page.tsx` — Remove `"use client"`, render `<RegisterForm />`
- `src/app/(auth)/forgot-password/page.tsx` — Remove `"use client"`, render `<ForgotPasswordForm />`

**Commit 5.3: Extract dashboard page content components**
- Create `src/components/mint/MintPageContent.tsx` — Move step-based rendering logic from page
- Create `src/components/redeem/RedeemPageContent.tsx` — same
- Create `src/components/transactions/TransactionList.tsx` — Move table/card rendering from page
- Create `src/components/profile/ProfileCard.tsx` — Move profile UI from page

**Commit 5.4: Convert dashboard pages to Server Components**
- `src/app/(dashboard)/mint/page.tsx` — Remove `"use client"`, render `<MintPageContent />`
- `src/app/(dashboard)/redeem/page.tsx` — Remove `"use client"`, render `<RedeemPageContent />`
- `src/app/(dashboard)/transactions/page.tsx` — Remove `"use client"`, render `<TransactionList />`
- `src/app/(dashboard)/profile/page.tsx` — Remove `"use client"`, render `<ProfileCard />`
- **IMPORTANT:** `src/app/(dashboard)/layout.tsx` must REMAIN `"use client"` — it uses `useState`, `useEffect`, `useRouter`, and `useAuthStore` for auth guard + mobile menu. Do NOT convert this to a Server Component.

**Commit 5.5: Remove root page.tsx, add server redirect**
- Delete `src/app/page.tsx` (client-side redirect to /login)
- Update `next.config.ts` — Add server-side redirect:
  ```typescript
  redirects: async () => [
    { source: "/", destination: "/login", permanent: false }
  ]
  ```

**Verify:** Agent-browser: all pages render correctly. Auth pages load faster (no wallet JS). Root `/` redirects to `/login`. All tests pass.

---

#### Phase 6: Error Boundaries (Next.js error.tsx)

**Goal:** Per-route error boundaries that catch runtime errors gracefully.

**Commits:**

**Commit 6.1: Create error.tsx files**
- Create `src/app/(dashboard)/error.tsx` — Dashboard-level fallback
- Create `src/app/(dashboard)/mint/error.tsx` — Mint-specific error UI with "Try Again" button
- Create `src/app/(dashboard)/redeem/error.tsx` — Redeem-specific error UI
- Create `src/app/(dashboard)/transactions/error.tsx` — Transactions error UI
- Create `src/app/(dashboard)/profile/error.tsx` — Profile error UI

Each `error.tsx` follows the pattern:
```typescript
"use client";
export default function MintError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} className="mt-4">Try Again</Button>
    </div>
  );
}
```

**Verify:** Agent-browser: trigger an error and verify boundary catches it.

---

#### Phase 7: Skeleton Components

**Goal:** Purpose-built loading skeletons matching exact component layout, responsive.

**Commits:**

**Commit 7.1: Create shared skeleton utilities**
- Create skeleton base in components — reusable `animate-pulse` blocks

**Commit 7.2: Mint skeletons**
- Create `src/components/mint/MintFormSkeleton.tsx` — Matches MintForm layout (responsive: stacked on mobile, same width on desktop)
- Create `src/components/mint/MintReviewSkeleton.tsx` — Matches MintReview layout

**Commit 7.3: Redeem skeletons**
- Create `src/components/redeem/RedeemFormSkeleton.tsx`
- Create `src/components/redeem/RedeemReviewSkeleton.tsx`
- Create `src/components/redeem/BankAccountSelectorSkeleton.tsx`

**Commit 7.4: Transaction + Profile skeletons**
- Create `src/components/transactions/TransactionListSkeleton.tsx` — Table skeleton on md+, card skeleton below
- Create `src/components/transactions/TransactionCardSkeleton.tsx` — Mobile card skeleton
- Create `src/components/profile/ProfileCardSkeleton.tsx`

**Commit 7.5: Integrate skeletons with isLoading**
- Update `MintPageContent.tsx` — Show `<MintFormSkeleton />` when loading
- Update `RedeemPageContent.tsx` — same
- Update `TransactionList.tsx` — Show skeleton when `isLoading`
- Update `ProfileCard.tsx` — same

**Verify:** Agent-browser: verify skeletons display during loading, match layout at all viewports.

---

#### Phase 8: Responsive Design

**Goal:** App works well on 4 viewports: 320, 375, 768, 1280.

**Commits:**

**Commit 8.1: Dashboard layout + Header — sidebar at md**
- `src/app/(dashboard)/layout.tsx` — Change sidebar from `hidden lg:flex` to `hidden md:flex`
- `src/app/(dashboard)/layout.tsx` — Change mobile menu trigger from `lg:hidden` to `md:hidden`
- `src/components/layout/Header.tsx` — Change hamburger button from `lg:hidden` to `md:hidden` (must stay in sync with sidebar breakpoint)
- Keep content padding: `p-4 md:p-6`

**Commit 8.2: Mint/Redeem pages — form layout at lg, not md**
- `src/components/mint/MintPageContent.tsx` — Keep `flex flex-col lg:flex-row` (side-by-side at lg only)
- `src/components/redeem/RedeemPageContent.tsx` — same
- At `md` (768px): sidebar visible, forms still stacked vertically (528px content area too narrow for side-by-side)

**Commit 8.3: Form components — responsive utilities**
- `MintForm.tsx` — Add `text-sm md:text-base` for labels, `p-4 md:p-6` for card padding
- `MintReview.tsx` — Add text wrapping for addresses, responsive padding
- `RedeemForm.tsx` — same responsive utilities
- `RedeemReview.tsx` — same

**Commit 8.4: ChainSelector — responsive grid**
- `src/components/shared/ChainSelector.tsx`:
  - Grid: `grid-cols-3 sm:grid-cols-4 md:grid-cols-5`
  - On small mobile (320px): dialog takes full width with `max-w-[calc(100vw-2rem)]`
  - Add proper scroll behavior: `max-h-[60vh] overflow-y-auto`

**Commit 8.5: Payment page — small screen fixes**
- `src/app/payment/page.tsx` — Change `p-6` to `p-4 sm:p-6`
- Ensure min touch target size (44x44px) on payment method buttons

**Commit 8.6: Header — responsive polish**
- Ensure avatar dropdown works on all viewports
- Touch-friendly menu items

**Commit 8.7: Auth pages — responsive polish**
- AuthLayout: already responsive, verify on 320px
- Form inputs: ensure no overflow on small screens

**Verify:** Agent-browser: check all 4 viewports for each page. No horizontal scroll, no clipping, no overflow.

---

#### Phase 9: Re-render Optimization

**Goal:** Reduce unnecessary re-renders in form-heavy pages.

**Commits:**

**Commit 9.1: React.memo for shared components**
- `src/components/shared/ChainSelector.tsx` — Wrap with `React.memo()`
- `src/components/redeem/BankAccountSelector.tsx` — Wrap with `React.memo()`

**Commit 9.2: useCallback for form handlers**
- `src/components/mint/MintForm.tsx` — Wrap `onChange` handlers with `useCallback`
- `src/components/redeem/RedeemForm.tsx` — same
- `src/components/auth/LoginForm.tsx` — same
- `src/components/auth/RegisterForm.tsx` — same

**Commit 9.3: useMemo for computed values**
- `src/components/layout/Header.tsx` — Memoize `initials` computation
- `src/hooks/useMint.ts` — `useMemo` for `selectedChain`
- `src/hooks/useRedeem.ts` — `useMemo` for `selectedChain`
- `src/hooks/useChainSelector.ts` — already has `useMemo`, verify

**Commit 9.4: Hoist static elements**
- `src/components/layout/Sidebar.tsx` — Hoist `navItems` array to module level (if not already)

**Verify:** All tests pass. No visual regressions.

---

#### Phase 10: Data Fetching + Architecture Fixes

**Goal:** Fix waterfalls, query invalidation, derived state, double-submission guard.

**Commits:**

**Commit 10.1: Fix dashboard layout hydration**
- `src/app/(dashboard)/layout.tsx` — Merge double `useEffect` into single effect

**Commit 10.2: Move bank accounts query to useRedeem hook**
- `src/hooks/useRedeem.ts` — Add `useQuery(["bankAccounts"])` here
- `src/components/redeem/RedeemReview.tsx` — Remove direct `useQuery`, get data from hook

**Commit 10.3: Add query invalidation after mutations**
- `src/hooks/useMint.ts` — In `createMintMutation.onSuccess`, invalidate `["transactions"]`
- `src/hooks/useRedeem.ts` — same for redeem mutation

**Commit 10.4: Derive isAuthenticated**
- `src/stores/authStore.ts` — Remove `isAuthenticated` as a stored/settable field. Zustand does not support JS getters in the store object. Instead, export a selector:
  ```typescript
  // In authStore.ts — remove isAuthenticated from state and setAuth/logout
  export const selectIsAuthenticated = (state: AuthState) => !!state.user && !!state.token;
  ```
  Usage in components: `const isAuthenticated = useAuthStore(selectIsAuthenticated);`
- Update all references:
  - `src/app/(dashboard)/layout.tsx` — use `useAuthStore(selectIsAuthenticated)`
  - `src/components/layout/Header.tsx` — if it reads `isAuthenticated`, update
  - `tests/helpers/playwright-utils.ts` — remove `isAuthenticated: true` from AUTH_STATE (no longer stored)
  - `tests/unit/stores/authStore.test.ts` — update tests to use selector

**Commit 10.5: Add double-submission guard in executeRedeem**
- `src/hooks/useRedeem.ts` — Check `isExecuting` before calling mutation in `executeRedeem`

**Commit 10.6: Fix QueryClient SSR leak**
- Already done in Phase 4 (moved to `useState`), verify here

**Verify:** All tests pass. Agent-browser: verify redeem double-click doesn't double-submit.

---

#### Phase 11: JS Micro-Optimizations

**Goal:** Hoist regex, Map lookups, cleanup.

**Commits:**

**Commit 11.1: Hoist RegExp to module level**
- `src/lib/validations.ts`:
  - `const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;`
  - `const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;`
  - Use in validator functions

**Commit 11.2: Map-based chain lookups**
- `src/lib/chains.ts`:
  ```typescript
  const CHAIN_MAP = new Map(SUPPORTED_CHAINS.map(c => [c.id, c]));
  export function getChainById(id: string): Chain | undefined {
    return CHAIN_MAP.get(id);
  }
  ```

**Commit 11.3: Remove dead code**
- `src/hooks/useChainSelector.ts` — Delete (confirmed unused: ChainSelector component has its own internal search state, never imports this hook)
- `next-themes` — Unused dependency, remove from package.json
- Any other dead code identified in the code review

**Verify:** All tests pass.

---

#### Phase 12: Unit Tests

**Goal:** Complete unit test coverage for hooks, API, and chains.

**Convention:** `describe('functionName') → describe('positive'/'negative'/'edge cases') → test(...)`

**Commits:**

**Commit 12.1: chains.test.ts**
- `tests/unit/lib/chains.test.ts`:
  - `getChainById`: positive (valid IDs), negative (invalid, empty), edge (case-sensitive)
  - `SUPPORTED_CHAINS`: 7 chains, all have required fields
  - `DEFAULT_CHAIN_ID` equals "base"

**Commit 12.2: mock-api.test.ts**
- `tests/unit/api/mock-api.test.ts`:
  - `mockLogin`: positive (valid creds), negative (wrong password, non-existent), edge (case-sensitive)
  - `mockRegister`: positive (new user), negative (duplicate email), edge (can login after register)
  - `mockCreateMint`: positive (correct fee), edge (unique IDs)
  - `mockCreateRedeem`: positive (correct receive amount), edge (receive = amount - fee)
  - `mockGetTransactions`: positive (returns array, all fields present)
  - `mockGetBankAccounts`: positive (returns accounts)
  - `mockGetWalletBalance`: positive (returns 5000)

**Commit 12.3: useAuth.test.tsx**
- `tests/unit/hooks/useAuth.test.tsx` — Using `renderHook` + `createWrapper()`:
  - `login`: positive (sets auth, loading states), negative (error on invalid), edge (clears previous error)
  - `register`: positive (creates user), negative (duplicate email)
  - `logout`: positive (clears state), edge (already logged out)
  - Mock `next/navigation` router

**Commit 12.4: useMint.test.tsx**
- `tests/unit/hooks/useMint.test.tsx`:
  - `validation`: positive (valid form), negative (min/max amount, invalid address), edge (lazy validation, boundary amounts, non-0x address)
  - `calculations`: positive (parsedAmount, fee 0.7%, paymentAmount), edge (zero, commas, undefined chain)
  - `step machine`: positive (goToReview, goBackToForm, proceedPayment), negative (invalid form blocks review), edge (data preserved on back)

**Commit 12.5: useRedeem.test.tsx**
- `tests/unit/hooks/useRedeem.test.tsx`:
  - `validation`: positive, negative (no bankAccountId), edge (lazy)
  - `calculations`: positive (receiveAmount, fee), edge (precision)
  - `step machine`: positive (all transitions), negative (blocked), edge (double-submission guard)

**Commit 12.6: useChainSelector.test.ts + useWalletBalance.test.tsx + useTransactions.test.tsx**
- `useChainSelector`: filter by name (case-insensitive), no match, special chars
- `useWalletBalance`: enabled when address present, disabled when undefined
- `useTransactions`: returns data, loading state

**Commit 12.7: Expand existing tests**
- `tests/unit/validations.test.ts` — Add non-0x address test, remove Solana tests
- `tests/unit/utils.test.ts` — Verify edge cases coverage

**Verify:** `pnpm test` — all unit tests pass.

---

#### Phase 13: Integration Tests

**Goal:** Page interaction tests with Playwright, 4 responsive viewports.

**Commits:**

**Commit 13.1: Redeem integration test**
- `tests/integration/dashboard/redeem.spec.ts`:
  - positive: displays form, chain selector, wallet prompt
  - negative: validation errors, disabled button
  - edge: chain selector dialog, amount formatting

**Commit 13.2: Payment integration test**
- `tests/integration/payment/payment.spec.ts`:
  - positive: shows payment details, completes payment
  - negative: redirects to /mint when no data (tests Phase 1 guard)
  - edge: back button

**Commit 13.3: Responsive tests — small mobile (320x568)**
- `tests/integration/responsive/small-mobile.spec.ts`:
  - No horizontal scroll on any page
  - Hamburger menu accessible
  - Form inputs not clipped
  - Chain selector grid 3 cols
  - Review detail rows wrap

**Commit 13.4: Responsive tests — mobile (375x667)**
- `tests/integration/responsive/mobile.spec.ts`:
  - Login renders correctly
  - Dashboard hamburger, no sidebar
  - Sheet menu navigation
  - Mint form stacks
  - Transactions card view
  - Chain selector responsive

**Commit 13.5: Responsive tests — tablet (768x1024)**
- `tests/integration/responsive/tablet.spec.ts`:
  - Sidebar visible at md
  - Mint form still stacked (not side-by-side at md)
  - Transactions table view
  - Chain selector 5 cols

**Commit 13.6: Responsive tests — desktop (1280x720)**
- `tests/integration/responsive/desktop.spec.ts`:
  - Full sidebar
  - Mint form + review side by side
  - All header elements visible

**Commit 13.7: Update existing integration tests + Playwright config**
- Migrate all tests to use shared helpers from `tests/helpers/playwright-utils.ts`
- Reorganize into `auth/` and `dashboard/` subdirectories
- Update `playwright.integration.config.ts` — Verify `testDir: "./tests/integration"` picks up nested subdirectories (Playwright recurses by default, but verify `testMatch` pattern if set)

**Verify:** `pnpm test:integration` — all pass.

---

#### Phase 14: E2E Tests

**Goal:** Full user flows running against local server.

**Commits:**

**Commit 14.1: Payment flow E2E**
- `tests/e2e/payment-flow.spec.ts`:
  - positive: mint → review → payment → success → back to mint
  - edge: payment shows correct amount

**Commit 14.2: Responsive flow E2E**
- `tests/e2e/responsive-flow.spec.ts`:
  - mobile (375): complete mint flow, navigate via menu, card transactions
  - tablet (768): complete mint flow, sidebar visible

**Commit 14.3: Expand existing E2E**
- `tests/e2e/redeem-flow.spec.ts` — Add negative: cannot proceed without wallet, form data preserved on back
- `tests/e2e/auth-flow.spec.ts` — Verify redirect to login when unauthenticated

**Verify:** `pnpm test:e2e` — all pass.

---

#### Phase 15: Documentation

**Goal:** README, CLAUDE.md, and sub-folder docs fully updated.

**Commits:**

**Commit 15.1: README.md rewrite**
- Full rewrite with: features, quick start, tech stack, architecture, folder structure, testing, demo credentials

**Commit 15.2: Root CLAUDE.md update**
- Add sections:
  - Performance Patterns (SC, skeletons, dynamic imports, memo)
  - Error Handling (error.tsx per route)
  - Component Architecture (shared/ + auth/ + feature/)
  - Provider Architecture (split providers)
  - Import Conventions (direct paths, no barrels)
  - Testing Strategy (unit/integration/e2e, 4 viewports)
  - Responsive Design (breakpoint strategy: md sidebar, lg side-by-side)

**Commit 15.3: Sub-folder CLAUDE.md updates**
- `src/app/CLAUDE.md` — SC patterns, error.tsx convention, redirect strategy
- `src/components/CLAUDE.md` — shared/, auth/, skeleton patterns, memo patterns, responsive breakpoints
- `src/hooks/CLAUDE.md` — useCallback patterns, query invalidation, prefetching
- `src/stores/CLAUDE.md` — Derived state, hydration patterns
- `src/lib/CLAUDE.md` — Hoisted regex, Map lookups, EVM-only validation
- `tests/CLAUDE.md` — Update with new test structure, helpers, conventions

**Verify:** Review all docs for accuracy. Agent-browser: spot-check that documented patterns match actual code.

---

## System-Wide Impact

### Interaction Graph

```
Phase 2 (folder move) → updates imports in MintForm, RedeemForm
Phase 3 (chains) → updates validations, mock-api, Wagmi config
Phase 4 (providers) → changes root layout, dashboard layout, auth page loading
Phase 5 (SC conversion) → extracts 8+ components from pages, changes rendering model
Phase 6 (error.tsx) → adds error handling layer to all dashboard routes
Phase 8 (responsive) → touches every layout and form component
Phase 10 (architecture) → changes authStore API, hook return values
Phase 12-14 (tests) → validates all prior changes
```

### Error Propagation

- **Auth errors:** `useAuth` hook → `loginError`/`registerError` → component display
- **Form validation:** validators → hooks → component conditional rendering
- **Query errors:** TanStack Query → `error` state → error.tsx boundaries catch unhandled
- **Route errors:** Next.js error.tsx → per-route fallback UI with `reset()` function

### State Lifecycle Risks

- **Payment page refresh:** Fixed by Phase 1 data guard (redirect to /mint)
- **Auth hydration:** Existing guard maintained, verified with derived `isAuthenticated`
- **Provider split:** QueryClientProvider stays in root — no cache split risk
- **Store reset:** Mint/redeem stores not persisted — intentional, reset on navigation

### API Surface Parity

- `getChainById` — used by hooks (useMint, useRedeem) and ChainSelector. All updated in Phase 3.
- `validateAddress` — used by useMint hook only. Updated in Phase 3.
- `isAuthenticated` — used by dashboard layout, Header dropdown. All updated in Phase 10.

### Integration Test Scenarios

1. Login → navigate to mint → fill form → review → payment → success → verify transaction in list
2. Login on mobile → hamburger menu → navigate to transactions → verify card view
3. Unauthenticated access to /mint → redirected to /login → login → arrives at /mint
4. Direct navigation to /payment (no mint data) → redirected to /mint
5. Mint form validation → fix errors → proceed → verify review shows correct calculations

## Acceptance Criteria

### Functional Requirements

- [ ] All pages render correctly at 4 viewports (320, 375, 768, 1280)
- [ ] Auth pages do not load wallet JavaScript (verify via network tab)
- [ ] Server Components render without `"use client"` (auth pages, dashboard pages)
- [ ] error.tsx files catch errors and show recovery UI
- [ ] Skeleton components display during loading, match responsive layout
- [ ] Chain selector shows 7 chains (no Solana)
- [ ] Payment page redirects to /mint when accessed without data
- [ ] Query invalidation updates transaction list after mint/redeem
- [ ] Double-click on Execute Redeem does not double-submit

### Non-Functional Requirements

- [ ] Auth page bundle size reduced by ~250KB (no RainbowKit/Wagmi)
- [ ] Zero `useCallback`/`useMemo` regressions (no stale closures)
- [ ] All existing tests still pass after each phase
- [ ] No TypeScript errors (`pnpm build` succeeds)

### Quality Gates

- [ ] Unit tests: 13 files, covering all hooks + API + chains + stores + lib
- [ ] Integration tests: 11 files, including 4 responsive viewport tests
- [ ] E2E tests: 5 files, covering all major user flows
- [ ] All CLAUDE.md files updated to reflect new architecture
- [ ] README.md fully written with quick start, tech stack, architecture

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Server Components | 0 (+ root layout) | 8 pages converted + root layout (already SC) |
| Auth page bundle | ~500KB+ | ~250KB (no wallet) |
| error.tsx boundaries | 0 | 5 files |
| Skeleton components | 0 | 8 components |
| Unit test files | 5 | 13 |
| Integration test files | 5 | 11 |
| E2E test files | 3 | 5 |
| Responsive breakpoints | lg only | sm + md + lg |
| Supported chains in Wagmi | 4 | 7 |
| Dead code | 217 lines | ~0 |

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SC conversion breaks hydration | Pages show errors | Test each page after conversion, keep `"use client"` on dashboard layout |
| Provider split breaks auth mutations | Login/register crash | Ensure QueryClientProvider in root Providers, not just WalletProviders |
| Derived isAuthenticated causes flash | Brief flash of redirect | Maintain hydration guard in dashboard layout |
| Custom chain definitions wrong | Wallet connection fails | Use confirmed chain IDs, test with agent-browser |
| Skeleton layout mismatch | Layout shift on load | Use same Tailwind responsive classes as real components |
| Test refactoring breaks existing tests | CI failures | Run tests after every commit, fix immediately |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-25-project-cleanup-brainstorm.md](docs/brainstorms/2026-03-25-project-cleanup-brainstorm.md)
  - Key decisions: remove Solana, per-feature error boundaries, detailed responsive skeletons, 4 viewports, renderHook testing
- **Code review:** [docs/reviews/2026-03-24-full-code-review.md](docs/reviews/2026-03-24-full-code-review.md)
  - 28 action items, 14 security findings, 217 lines dead code

### Internal References

- Existing test patterns: `tests/unit/validations.test.ts`
- State flow: `src/hooks/useMint.ts` (canonical hook pattern)
- Store pattern: `src/stores/authStore.ts` (persist middleware)
- Wagmi config: `src/providers/Providers.tsx:12-25`
- Chain definitions: `src/lib/chains.ts`

### External References

- Vercel React Best Practices: 65 rules in `~/.claude/skills/vercel-react-best-practices/`
- Next.js App Router error handling: `error.tsx` convention
- RainbowKit docs: chain configuration
- Wagmi `defineChain`: custom EVM chain definitions
