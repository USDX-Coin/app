---
date: 2026-03-25
topic: project-cleanup-deep-refactor
---

# USDX Project Cleanup & Deep Refactor

## What We're Building

Refactoring menyeluruh untuk USDX app: merapikan folder structure, menerapkan Vercel React best practices (65 rules), memperbaiki README, update CLAUDE.md, review setiap folder besar, comprehensive testing (unit + integration + e2e), dan responsive design.

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Payment page | Biarkan di posisi sekarang (standalone, di luar dashboard) |
| Error boundaries | Per-feature (bukan satu global) |
| Chain config | Tambah 3 EVM chains missing ke Wagmi (etherlink, kaia, monad) |
| Loading states | Skeleton approach (bukan spinner) |
| Solana | **Hapus dari SUPPORTED_CHAINS** — simplify, hanya EVM chains |
| Hook testing | **renderHook** dengan real Zustand + mocked router/query |
| MSW | ~~Tambah MSW~~ **OVERRIDDEN in plan:** Skip MSW, use Playwright `page.route()` — app makes zero HTTP requests, MSW has nothing to intercept |
| Responsive testing | **4 viewports**: Small Mobile (320x568) + Mobile (375x667) + Tablet (768x1024) + Desktop (1280x720) |
| Skeleton granularity | **Detailed**: skeleton per component matching exact layout |

## Current State Assessment

| Area | Score | Notes |
|------|-------|-------|
| Folder Structure | 7/10 | ChainSelector misplaced, empty folders, no shared/ |
| Server Components | 2/10 | Semua page `"use client"`, zero Server Components |
| Suspense/Streaming | 0/10 | Zero Suspense boundaries |
| Bundle Optimization | 4/10 | RainbowKit/Wagmi loaded globally, no dynamic imports |
| Data Fetching | 5/10 | 3 waterfall patterns, no parallel fetching |
| Re-render Optimization | 3/10 | Zero memo/useCallback, 15+ inline functions |
| Code Quality | 7/10 | Clean separation, good types, but some violations |
| Documentation | 4/10 | CLAUDE.md good, README empty, sub-folder docs outdated |
| Test Coverage | 5/10 | Basic tests exist, no hook tests, no MSW, gaps in e2e |
| Responsive Design | 5/10 | Auth/dashboard layout ok, forms/reviews not responsive |

---

## Part 1: Folder Structure Cleanup

### 1.1 Create `components/shared/` for cross-feature components

**Current:**
```
components/mint/ChainSelector.tsx  <- used by BOTH Mint and Redeem
components/profile/               <- empty folder
components/transactions/           <- empty folder
```

**Proposed:**
```
components/
  shared/
    ChainSelector.tsx             <- moved from mint/
  auth/                           <- NEW: extracted from pages
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
    MintFormSkeleton.tsx          <- NEW: skeleton for Suspense
  redeem/
    RedeemForm.tsx
    RedeemReview.tsx
    BankAccountSelector.tsx
    RedeemFormSkeleton.tsx        <- NEW: skeleton
  transactions/
    TransactionList.tsx           <- NEW: extracted from page
    TransactionListSkeleton.tsx   <- NEW: skeleton
  profile/
    ProfileCard.tsx               <- NEW: extracted from page
    ProfileCardSkeleton.tsx       <- NEW: skeleton
  errors/                         <- NEW: error boundaries
    MintErrorBoundary.tsx
    RedeemErrorBoundary.tsx
    TransactionsErrorBoundary.tsx
    ProfileErrorBoundary.tsx
  ui/
    (shadcn components - no change)
```

**Actions:**
- Move `ChainSelector.tsx` dari `components/mint/` ke `components/shared/`
- Buat `components/auth/` untuk form components yang di-extract dari pages
- Buat skeleton components untuk setiap feature
- Buat error boundary per feature
- Extract inline page content ke dedicated components
- Update semua import paths
- Update `src/components/CLAUDE.md`

### 1.2 Split Providers (auth vs dashboard)

**Current:** Single `Providers.tsx` wraps entire app with RainbowKit + Wagmi + QueryClient.

**Proposed:**
```
providers/
  Providers.tsx           <- QueryClient + Toaster only (lightweight, for all pages)
  WalletProviders.tsx     <- RainbowKit + Wagmi (heavy, dashboard only)
```

**Why:** Auth pages don't need wallet — RainbowKit (~150KB) + Wagmi (~100KB) shouldn't load for them.

### 1.3 Root page redirect

**Current:** `src/app/page.tsx` is `"use client"` with `router.replace("/login")`.

**Proposed:** Server-side redirect in `next.config.ts`:
```typescript
redirects: async () => [
  { source: "/", destination: "/login", permanent: false }
]
```
Hapus `src/app/page.tsx` entirely.

---

## Part 2: Vercel React Best Practices

### 2.1 Server Components (Priority: HIGH)

Pages yang bisa jadi Server Component:

| Page | Current | Can Be SC? | Extract To |
|------|---------|------------|------------|
| `(auth)/layout.tsx` | Client | YES | No extraction needed |
| `(auth)/login/page.tsx` | Client | YES | `components/auth/LoginForm.tsx` |
| `(auth)/register/page.tsx` | Client | YES | `components/auth/RegisterForm.tsx` |
| `(auth)/forgot-password/page.tsx` | Client | YES | `components/auth/ForgotPasswordForm.tsx` |
| `(dashboard)/mint/page.tsx` | Client | YES | Already has MintForm/MintReview |
| `(dashboard)/redeem/page.tsx` | Client | YES | Already has RedeemForm/RedeemReview |
| `(dashboard)/transactions/page.tsx` | Client | YES | `components/transactions/TransactionList.tsx` |
| `(dashboard)/profile/page.tsx` | Client | YES | `components/profile/ProfileCard.tsx` |
| `payment/page.tsx` | Client | NO | Needs router, store |

### 2.2 Suspense Boundaries + Skeletons (Priority: HIGH)

**Locations:**
1. **Dashboard pages** — Wrap feature components with Suspense + feature skeleton
2. **Transactions page** — TransactionList with TransactionListSkeleton
3. **Redeem page** — BankAccountSelector with skeleton
4. **Profile page** — ProfileCard with ProfileCardSkeleton

**Skeleton design:** Match the actual component layout with animated pulse placeholders.

### 2.3 Bundle Optimization (Priority: HIGH)

1. **Split WalletProviders** — Only in `(dashboard)` layout
2. **Dynamic import ChainSelector Dialog** — Lazy-load on user click
3. **Move RainbowKit CSS** — From global to dashboard-only
4. **Defer Toaster** — Load after hydration

### 2.4 Data Fetching Waterfalls (Priority: MEDIUM-HIGH)

1. **Dashboard layout** — Merge double useEffect into single effect
2. **RedeemReview** — Prefetch bank accounts in useRedeem hook
3. **Wallet balance** — Acceptable waterfall (depends on wallet connect)

### 2.5 Re-render Optimization (Priority: MEDIUM)

1. **React.memo()** — ChainSelector, BankAccountSelector
2. **useCallback** — All event handlers in forms (MintForm, RedeemForm, login/register)
3. **useMemo** — Header initials, selectedChain in hooks
4. **Hoist static JSX** — Sidebar nav items, Logo

### 2.6 JavaScript Performance (Priority: LOW-MEDIUM)

1. **Hoist RegExp** — validations.ts: EMAIL_REGEX, EVM_REGEX, SOLANA_REGEX ke module level
2. **Map-based lookups** — chains.ts: CHAIN_MAP instead of .find()
3. **Early exits** — Review all validators for consistency

---

## Part 3: Error Boundaries (Per-Feature)

### Strategy

Setiap feature area punya error boundary sendiri:

```tsx
// components/errors/MintErrorBoundary.tsx
"use client";
import { ErrorBoundary } from "react";

export function MintErrorBoundary({ children }) {
  return (
    <ErrorBoundary fallback={
      <div className="p-6 text-center">
        <h2>Something went wrong with minting</h2>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    }>
      {children}
    </ErrorBoundary>
  );
}
```

**Placement:**
- Mint page: Wrap MintForm + MintReview
- Redeem page: Wrap RedeemForm + RedeemReview
- Transactions page: Wrap TransactionList
- Profile page: Wrap ProfileCard

---

## Part 4: Chain Config Sync

**Current mismatch:**
- Wagmi config (Providers.tsx): `base, bsc, polygon, lisk` (4 chains)
- App config (chains.ts): `base, lisk, bsc, polygon, solana, etherlink, kaia, monad` (8 chains)

**Action:** Tambah 4 chain yang missing ke Wagmi config:
- `solana` — Note: Wagmi doesn't support Solana natively. Needs separate handler or skip.
- `etherlink` — Custom EVM chain definition needed
- `kaia` — Custom EVM chain definition needed
- `monad` — Custom EVM chain definition needed (testnet)

**Decision needed (see Open Questions below):** Solana handling in Wagmi.

---

## Part 5: Responsive Design

### Current State

| Component | Responsive? | Breakpoints Used |
|-----------|-------------|-----------------|
| AuthLayout | YES | `lg` only |
| Dashboard Layout | YES | `lg` only |
| Header | YES | `sm`, `lg` |
| Sidebar | N/A | Controlled by parent |
| Mint Page | PARTIAL | `lg` only |
| Mint Form | NO | None |
| Mint Review | NO | None |
| Redeem Page | PARTIAL | `lg` only |
| Redeem Form | NO | None |
| Redeem Review | NO | None |
| Transactions | YES | `md` (best in codebase) |
| Profile | NO | None |
| Payment | PARTIAL | Implicit via max-w |
| ChainSelector | PARTIAL | Fixed grid |

### Responsive Fixes Needed

**1. Tablet breakpoint (`md: 768px`) — Missing everywhere except Transactions**

Add `md:` breakpoint to:
- Dashboard layout: show sidebar at `md` instead of `lg`
- Mint/Redeem pages: side-by-side layout at `md` instead of `lg`

**2. Form components — Zero responsive utilities**

MintForm, RedeemForm, MintReview, RedeemReview need:
- Text size adjustments for mobile (`text-sm` on mobile, `text-base` on desktop)
- Padding adjustments (`p-4` on mobile, `p-6` on desktop)
- Address/hash truncation on mobile
- Review detail rows: stack vertically on very small screens

**3. ChainSelector grid — Fixed 5 columns**

Change to responsive: `grid-cols-3 sm:grid-cols-4 md:grid-cols-5`

**4. Payment page — Small phone padding**

Add: `p-4 sm:p-6` instead of fixed `p-6`

**5. Profile page — No responsive handling**

Add responsive card layout with proper spacing.

### Breakpoint Strategy

```
Mobile-first approach:
- Default (< 640px): Single column, compact spacing
- sm (640px+): Slightly more breathing room
- md (768px+): Side-by-side layouts where appropriate
- lg (1024px+): Full desktop with sidebar
```

---

## Part 6: Comprehensive Testing Strategy

### Test Architecture

```
tests/
  setup.ts                          # Vitest setup (jest-dom)
  helpers/
    test-utils.tsx                  # NEW: renderWithProviders, createMockStore
    playwright-utils.ts             # NEW: shared Playwright helpers
    msw-handlers.ts                 # NEW: MSW request handlers
    msw-server.ts                   # NEW: MSW server setup
  unit/
    lib/
      validations.test.ts           # EXISTS: expand edge cases
      utils.test.ts                 # EXISTS: expand edge cases
      chains.test.ts                # NEW: getChainById, CHAIN_MAP
      constants.test.ts             # NEW: verify constant values
    api/
      mock-api.test.ts              # NEW: all mock API functions
    stores/
      authStore.test.ts             # EXISTS: expand edge cases
      mintStore.test.ts             # EXISTS: expand edge cases
      redeemStore.test.ts           # EXISTS: expand edge cases
    hooks/
      useAuth.test.tsx              # NEW: login/register/logout flows
      useMint.test.tsx              # NEW: validation, calculations, step machine
      useRedeem.test.tsx            # NEW: validation, calculations, step machine
      useChainSelector.test.ts      # NEW: search/filter logic
      useWalletBalance.test.tsx     # NEW: query enable/disable
      useTransactions.test.tsx      # NEW: query behavior
  integration/
    auth/
      login.spec.ts                 # EXISTS: expand with MSW
      register.spec.ts              # EXISTS: expand with MSW
    dashboard/
      mint.spec.ts                  # EXISTS: expand negative/edge
      redeem.spec.ts                # NEW: full redeem page tests
      transactions.spec.ts          # EXISTS: expand
      profile.spec.ts               # EXISTS: expand
    payment/
      payment.spec.ts               # NEW: payment page tests
    responsive/
      mobile.spec.ts                # NEW: mobile viewport tests
      tablet.spec.ts                # NEW: tablet viewport tests
  e2e/
    auth-flow.spec.ts               # EXISTS: expand
    mint-flow.spec.ts               # EXISTS: expand
    redeem-flow.spec.ts             # EXISTS: expand negative/edge
    payment-flow.spec.ts            # NEW: full payment gateway flow
    responsive-flow.spec.ts         # NEW: flows on mobile/tablet
```

### 6.1 Unit Tests (Vitest)

Convention: `describe('functionName') -> describe('positive'/'negative'/'edge cases') -> test(...)`

#### NEW: hooks/ tests (biggest gap)

**`useAuth.test.tsx`**
```
describe('useAuth')
  describe('login')
    describe('positive')
      test('sets auth state on successful login')
      test('redirects to /mint after login')
      test('returns loginLoading=true during mutation')
    describe('negative')
      test('sets loginError on invalid credentials')
      test('does not set auth on failed login')
    describe('edge cases')
      test('handles concurrent login attempts')
      test('clears previous error on new attempt')

  describe('register')
    describe('positive')
      test('creates user and sets auth')
      test('redirects to /mint after register')
    describe('negative')
      test('sets registerError on duplicate email')
    describe('edge cases')
      test('handles concurrent register attempts')

  describe('logout')
    describe('positive')
      test('clears auth state')
      test('redirects to /login')
    describe('edge cases')
      test('handles logout when already logged out')
```

**`useMint.test.tsx`**
```
describe('useMint')
  describe('validation')
    describe('positive')
      test('no errors when form is valid')
      test('isFormValid true with valid amount and address')
    describe('negative')
      test('amountError for amount below minimum (10)')
      test('amountError for amount above maximum (1,000,000)')
      test('addressError for invalid EVM address')
      test('addressError for invalid EVM address (wrong length)')
      test('addressError for invalid EVM address (bad hex chars)')
    describe('edge cases')
      test('no validation when fields are empty (lazy validation)')
      test('validates amount with comma separators')
      test('validates exact boundary amounts (10, 1000000)')
      test('addressError for non-0x address (EVM only after Solana removal)')

  describe('calculations')
    describe('positive')
      test('parsedAmount correctly parses string to number')
      test('fee is 0.7% of parsedAmount')
      test('paymentAmount equals parsedAmount * EXCHANGE_RATE')
      test('selectedChain matches chainId')
    describe('edge cases')
      test('calculations handle zero amount')
      test('calculations handle comma-separated amount')
      test('selectedChain undefined for invalid chainId')

  describe('step machine')
    describe('positive')
      test('goToReview sets step to "review" when form valid')
      test('goBackToForm sets step to "form"')
      test('proceedPayment calls mutation and sets step to "payment"')
    describe('negative')
      test('goToReview does nothing when form invalid')
    describe('edge cases')
      test('form data preserved after goBackToForm')
      test('goBackToForm from review preserves all fields')
```

**`useRedeem.test.tsx`**
```
describe('useRedeem')
  describe('validation')
    describe('positive')
      test('no errors when form is valid')
      test('isFormValid true with valid amount and bankAccountId')
    describe('negative')
      test('amountError for invalid amounts')
      test('isFormValid false without bankAccountId')
    describe('edge cases')
      test('lazy validation - no error when empty')

  describe('calculations')
    describe('positive')
      test('receiveAmount = parsedAmount - fee')
      test('fee is 0.7% of parsedAmount')
    describe('edge cases')
      test('calculations with zero amount')
      test('fee precision with decimal amounts')

  describe('step machine')
    describe('positive')
      test('goToReview sets step to "review"')
      test('executeRedeem transitions: executing -> success')
    describe('negative')
      test('goToReview blocked when form invalid')
    describe('edge cases')
      test('executeRedeem with empty walletAddress')
      test('step stays "executing" on mutation failure')
```

**`useChainSelector.test.ts`**
```
describe('useChainSelector')
  describe('filteredChains')
    describe('positive')
      test('returns all chains when search is empty')
      test('filters chains by name (case-insensitive)')
      test('partial match: "ba" returns Base and BSC')
    describe('negative')
      test('returns empty array when no match')
    describe('edge cases')
      test('search with special characters does not crash')
      test('search with spaces trims input')
```

#### NEW: api/ tests

**`mock-api.test.ts`**
```
describe('mockLogin')
  describe('positive')
    test('returns user and token for valid credentials')
  describe('negative')
    test('throws error for wrong password')
    test('throws error for non-existent email')
  describe('edge cases')
    test('credentials are case-sensitive')

describe('mockRegister')
  describe('positive')
    test('creates new user and returns auth response')
  describe('negative')
    test('throws error for duplicate email')
  describe('edge cases')
    test('registered user can subsequently login')

describe('mockCreateMint')
  describe('positive')
    test('returns MintOrder with correct fee calculation')
    test('generates unique order ID')
  describe('edge cases')
    test('fee precision for decimal amounts')

describe('mockCreateRedeem')
  describe('positive')
    test('returns RedeemOrder with correct receive amount')
    test('generates txHash')
  describe('edge cases')
    test('receive amount = amount - fee')

describe('mockGetTransactions')
  describe('positive')
    test('returns array of transactions')
    test('each transaction has required fields')

describe('mockGetBankAccounts')
  describe('positive')
    test('returns bank accounts with masked numbers')

describe('mockGetWalletBalance')
  describe('positive')
    test('returns consistent balance (5000)')
```

#### EXPAND: Existing tests

**`chains.test.ts`** (NEW)
```
describe('getChainById')
  describe('positive')
    test('returns chain for valid ID "base"')
    test('returns chain for each of 8 supported chains')
  describe('negative')
    test('returns undefined for invalid ID')
    test('returns undefined for empty string')
  describe('edge cases')
    test('chain IDs are case-sensitive')

describe('SUPPORTED_CHAINS')
  test('contains exactly 8 chains')
  test('each chain has id, name, shortName, icon, contractAddress')
  test('DEFAULT_CHAIN_ID is "base"')
```

### 6.2 Integration Tests (Playwright + MSW)

**Setup MSW for Playwright:**

MSW akan intercept network requests di browser context. Karena app pakai mock-api.ts (bukan real API), integration tests perlu approach berbeda:

**Option A: MSW di browser** — Intercept fetch/XHR calls
**Option B: Playwright route mocking** — `page.route()` untuk mock responses
**Option C: Keep using mock-api** — Tests already work because app uses mock-api internally

**Decision: Tambah MSW untuk integration tests.** MSW browser worker akan intercept HTTP requests di Playwright browser context. mock-api.ts tetap untuk development. MSW handlers mirror mock-api responses untuk testing yang lebih realistis.

Setup:
- `tests/helpers/msw-handlers.ts` — Request handlers (login, register, transactions, mint, redeem)
- `tests/helpers/msw-browser.ts` — MSW browser worker setup
- Integration tests inject MSW via `page.addInitScript()` atau custom fixture

**NEW: `redeem.spec.ts`**
```
describe('Redeem Page')
  describe('positive')
    test('displays redeem form after login')
    test('shows chain selector with default chain')
    test('shows connect wallet prompt')
    test('amount input accepts valid values')
  describe('negative')
    test('shows validation error for amount below minimum')
    test('shows validation error for amount above maximum')
    test('Review Redeem disabled without wallet connection')
  describe('edge cases')
    test('chain selector dialog opens and closes')
    test('amount formatting with commas')
```

**NEW: `payment.spec.ts`**
```
describe('Payment Page')
  describe('positive')
    test('displays payment details from mint flow')
    test('shows payment method options')
    test('completes payment and shows success')
  describe('negative')
    test('shows error state for failed payment')
  describe('edge cases')
    test('back button returns to mint')
```

**NEW: `responsive/small-mobile.spec.ts`**
```
describe('Small Mobile Responsive (320x568)')
  test('login page fits without horizontal scroll')
  test('dashboard hamburger menu accessible')
  test('mint form inputs not clipped')
  test('chain selector grid adapts (3 cols)')
  test('payment page card fits within viewport')
  test('review detail rows wrap properly')
```

**NEW: `responsive/mobile.spec.ts`**
```
describe('Mobile Responsive (375x667)')
  test('login page renders correctly on mobile')
  test('dashboard shows hamburger menu, no sidebar')
  test('mobile sheet menu opens and navigates')
  test('mint form stacks vertically')
  test('mint review stacks below form')
  test('transactions show card view, not table')
  test('chain selector adapts to mobile width')
  test('profile page renders without overflow')
```

**NEW: `responsive/tablet.spec.ts`**
```
describe('Tablet Responsive (768x1024)')
  test('dashboard shows sidebar at md breakpoint')
  test('mint form shows side-by-side at md breakpoint')
  test('mint review panel visible beside form')
  test('transactions show table view')
  test('chain selector shows 5-col grid')
```

**NEW: `responsive/desktop.spec.ts`**
```
describe('Desktop Responsive (1280x720)')
  test('full sidebar visible')
  test('mint form + review side by side with max-width')
  test('transactions full table with all columns')
  test('header shows all elements')
```

### 6.3 E2E Tests (Playwright — Full Flows)

**EXPAND: `redeem-flow.spec.ts`**
```
describe('Redeem Flow')
  describe('positive')
    test('complete redeem: login -> form -> review -> execute -> success')
  describe('negative')
    test('cannot redeem without wallet connected')
    test('cannot proceed with invalid amount')
  describe('edge cases')
    test('can go back from review to form')
    test('form data preserved after going back')
```

**NEW: `payment-flow.spec.ts`**
```
describe('Payment Flow')
  describe('positive')
    test('mint -> review -> payment gateway -> success -> back to mint')
  describe('edge cases')
    test('payment page shows correct amount from mint')
    test('success page has link back to dashboard')
```

**NEW: `responsive-flow.spec.ts`**
```
describe('Responsive Flows')
  describe('mobile (375x667)')
    test('complete mint flow on mobile')
    test('navigate via mobile menu')
    test('view transactions in card format')
  describe('tablet (768x1024)')
    test('complete mint flow on tablet')
    test('sidebar visible on tablet')
```

### 6.4 Test Helpers (NEW files)

**`tests/helpers/test-utils.tsx`** — Vitest helpers
```typescript
// Wrapper with QueryClientProvider for hook testing
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Reset all stores between tests
function resetStores() {
  useAuthStore.getState().logout();
  useMintStore.getState().reset();
  useRedeemStore.getState().reset();
}
```

**`tests/helpers/playwright-utils.ts`** — Playwright helpers
```typescript
// Inject auth into localStorage
async function loginViaStorage(page: Page) { ... }

// Set viewport for responsive tests
async function setMobileViewport(page: Page) { page.setViewportSize({ width: 375, height: 667 }); }
async function setTabletViewport(page: Page) { page.setViewportSize({ width: 768, height: 1024 }); }
```

### 6.5 Test Summary

| Type | Existing | New | Total |
|------|----------|-----|-------|
| Unit (Vitest) | 5 files | 8 files | 13 files |
| Integration (Playwright + MSW) | 5 files | 6 files | 11 files |
| E2E (Playwright) | 3 files | 2 files | 5 files |
| Helpers / Setup | 1 file | 4 files | 5 files |
| **Total** | **14** | **20** | **34 files** |

### 6.6 Responsive Test Viewports

| Viewport | Size | Focus |
|----------|------|-------|
| Small Mobile | 320x568 | iPhone SE, overflow, clipping |
| Mobile | 375x667 | iPhone standard, primary mobile UX |
| Tablet | 768x1024 | iPad, md breakpoint, sidebar behavior |
| Desktop | 1280x720 | Laptop, full layout verification |

---

## Part 7: Architecture Fixes

### 7.1 Chain Config Sync

**Hapus Solana** dari SUPPORTED_CHAINS (non-EVM, tidak compatible dengan Wagmi).

Tambah 3 custom EVM chains ke Wagmi config:
- `etherlink` — Custom EVM chain definition (chainId: TBD)
- `kaia` — Custom EVM chain definition (chainId: 8217)
- `monad` — Custom EVM chain definition (testnet, chainId: TBD)

Update chains.ts: 8 → 7 chains (remove Solana).
Update validations.ts: remove Solana address validation (hanya EVM 0x format).

### 7.2 Query Invalidation

After mint/redeem mutation success, invalidate transactions:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
}
```

### 7.3 RedeemReview useQuery

Move `useQuery(["bankAccounts"])` dari RedeemReview ke useRedeem hook. Keep hooks as single API for components.

### 7.4 isAuthenticated Derivation

Derive from `!!user && !!token` instead of storing as separate field. Reduce surface area for state desync.

---

## Part 8: Documentation

### 8.1 README.md — Full Rewrite

Structure:
1. Project title + description
2. Features list
3. Quick Start (install, dev, build)
4. Tech Stack table
5. Architecture overview
6. Folder structure
7. Testing commands
8. Demo credentials
9. Development guidelines

### 8.2 Root CLAUDE.md — Update

Add sections:
- Performance Patterns (SC, Suspense, dynamic imports, memo)
- Error Handling (per-feature error boundaries)
- Component Architecture (shared/ vs feature-specific)
- Provider Architecture (split providers)
- Import Conventions (no barrel imports)
- Testing Strategy (unit/integration/e2e)
- Responsive Design (breakpoint strategy)

### 8.3 Sub-folder CLAUDE.md Updates

| File | Updates |
|------|---------|
| `src/app/CLAUDE.md` | SC patterns, redirect strategy, Suspense, error boundaries |
| `src/components/CLAUDE.md` | shared/, auth/, errors/, skeleton components, memo patterns |
| `src/hooks/CLAUDE.md` | Prefetching, query invalidation, useCallback patterns |
| `src/stores/CLAUDE.md` | Derived state, hydration best practices |
| `src/lib/CLAUDE.md` | Hoisted regex, Map lookups, validation patterns |

---

## Implementation Order (Updated)

| Phase | Scope | Files | Risk |
|-------|-------|-------|------|
| **1** | Folder structure cleanup | ~15 | Low |
| **2** | Provider splitting + bundle optimization | ~5 | Medium |
| **3** | Server Component conversion + auth form extraction | ~12 | Medium |
| **4** | Suspense boundaries + skeleton components | ~10 | Low |
| **5** | Error boundaries (per-feature) | ~5 | Low |
| **6** | Re-render optimization (memo, useCallback, useMemo) | ~10 | Low |
| **7** | Data fetching waterfall fixes | ~4 | Low |
| **8** | JS micro-optimizations (regex, Map, early exit) | ~3 | Low |
| **9** | Chain config sync (remove Solana, add 3 EVM to Wagmi) | ~4 | Medium |
| **10** | Architecture fixes (query invalidation, derived state) | ~5 | Low |
| **11** | Responsive design fixes | ~12 | Low |
| **12** | Unit tests (hooks, API, chains) | ~8 | None |
| **13** | Integration tests + MSW setup (redeem, payment, responsive x4) | ~10 | None |
| **14** | E2E tests (payment flow, responsive flows x4 viewports) | ~4 | None |
| **15** | Documentation (README, CLAUDE.md, sub-docs) | ~8 | None |

**Total estimated: ~115 file changes across 15 phases**

---

## All Questions Resolved

Semua keputusan sudah final. Tidak ada open questions.

### Impact dari Keputusan

**Hapus Solana:**
- Remove Solana dari `SUPPORTED_CHAINS` di chains.ts (8 → 7 chains)
- Remove Solana address validation logic dari validations.ts
- Simplify: semua chains sekarang EVM-compatible, consistent dengan Wagmi
- Tambah 3 custom EVM chain definitions ke Wagmi: etherlink, kaia, monad

**renderHook + real Zustand:**
- Hook tests menggunakan `@testing-library/react` `renderHook`
- Zustand stores berjalan real (reset di beforeEach)
- Next.js router di-mock via `vi.mock("next/navigation")`
- QueryClient dibuat fresh per test dengan `retry: false`

**MSW untuk integration tests:**
- Setup MSW browser worker untuk Playwright integration tests
- Intercept HTTP requests di browser context
- mock-api.ts tetap dipakai untuk development & unit tests
- MSW handlers mirror mock-api.ts responses
- File baru: `tests/helpers/msw-handlers.ts`, `tests/helpers/msw-server.ts`

**4 viewports responsive testing:**
- Small Mobile: 320x568 (iPhone SE, small Android)
- Mobile: 375x667 (iPhone standard)
- Tablet: 768x1024 (iPad)
- Desktop: 1280x720 (laptop)
- Setiap viewport di-test di integration + e2e

**Detailed skeletons:**
- Setiap component punya skeleton yang match exact layout
- Skeleton menggunakan `animate-pulse` + matching dimensions
- Files baru per feature: MintFormSkeleton, MintReviewSkeleton, RedeemFormSkeleton, RedeemReviewSkeleton, TransactionListSkeleton, TransactionCardSkeleton, ProfileCardSkeleton, BankAccountSelectorSkeleton

## Next Steps

-> `/ce:plan` untuk implementation detail per-phase
