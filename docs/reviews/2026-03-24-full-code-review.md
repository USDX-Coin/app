---
date: 2026-03-24
reviewers: architecture-strategist, pattern-recognition, security-sentinel, performance-oracle, code-simplicity
scope: Full repository review
---

# USDX App — Full Code Review

## Executive Summary

The USDX app is a well-structured Next.js 15 prototype for a USD stablecoin with minting and redeeming. The architecture follows clean layering (Store → Hook → Component → API) with strong TypeScript usage (strict mode, no `any`). However, the review identified **14 security findings** (4 critical), **4 critical performance issues**, **17 pattern/quality issues**, and **217 lines of dead/speculative code** that should be addressed before production.

**Overall Score: 7/10** — Solid prototype architecture, needs hardening for production.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Security](#2-security)
3. [Performance](#3-performance)
4. [Code Patterns & Quality](#4-code-patterns--quality)
5. [Code Simplicity](#5-code-simplicity)
6. [Consolidated Action Items](#6-consolidated-action-items)

---

## 1. Architecture

### Strengths

- **Clean layered architecture**: `Store → Hook → Component → API` is well-defined and mostly followed
- **Route groups**: `(auth)` and `(dashboard)` properly separate authenticated/unauthenticated pages
- **Zustand/TanStack Query split**: Client state in Zustand, server state in TanStack Query — correct separation
- **Stores are minimal**: `mintStore` and `redeemStore` are under 32 lines each, containing only state + setters
- **Hooks as orchestration layer**: `useMint`, `useRedeem`, `useAuth` combine store + validation + calculations + mutations
- **Mock API layer**: Clean abstraction that can be swapped for real backend

### Issues

| ID | Issue | Severity | File |
|----|-------|----------|------|
| A1 | `ChainSelector` lives in `components/mint/` but is shared with Redeem | Medium | `src/components/mint/ChainSelector.tsx` |
| A2 | `RedeemReview` makes direct `useQuery` call, bypassing hook layer | Medium | `src/components/redeem/RedeemReview.tsx:27-30` |
| A3 | `isAuthenticated` stored redundantly — should be derived from `!!user && !!token` | Low | `src/stores/authStore.ts:8` |
| A4 | No query cache invalidation after mint/redeem mutations | Medium | `src/hooks/useMint.ts`, `src/hooks/useRedeem.ts` |
| A5 | Chain config mismatch: Wagmi configures 4 chains, app defines 8 | High | `src/providers/Providers.tsx:16` vs `src/lib/chains.ts` |
| A6 | `Chain` type uses string IDs but Wagmi uses numeric chain IDs — no mapping exists | High | `src/types/index.ts` |
| A7 | `/payment` page is outside `(dashboard)` route group — no auth guard | High | `src/app/payment/page.tsx` |
| A8 | Payment page has no state validation — renders $0 if accessed directly | Medium | `src/app/payment/page.tsx` |
| A9 | Root `/` redirect is client-side only — should use server-side `redirect()` | Low | `src/app/page.tsx` |
| A10 | All pages are `"use client"` — no Server Components used | Medium | All `src/app/` files |

### Recommendations

1. Move `ChainSelector` to `components/shared/`
2. Extract `useBankAccounts` hook; remove direct query from `RedeemReview`
3. Unify chain configs or create mapping between app chain IDs and Wagmi chain IDs
4. Move `/payment` inside `(dashboard)` route group
5. Add state guard on payment page to redirect if mint data is incomplete
6. Invalidate `["transactions"]` query after successful mint/redeem

---

## 2. Security

### Critical Findings

| ID | Finding | Impact |
|----|---------|--------|
| S1 | **Auth token in localStorage** — accessible to XSS, never expires | Token theft via any XSS vector |
| S2 | **No server-side route protection** — no `middleware.ts`, client-only auth check | Dashboard pages accessible by manipulating localStorage |
| S3 | **Payment page unprotected** — outside `(dashboard)`, no auth check at all | Unauthorized access to payment flow |
| S4 | **Hardcoded credentials** — `demo@usdx.com`/`Demo1234` in source, plaintext passwords, predictable token format | Credential exposure in JS bundle |

### High Findings

| ID | Finding | Impact |
|----|---------|--------|
| S5 | No CSRF protection on state-changing operations | Cross-site request forgery on mint/redeem |
| S6 | No security headers (CSP, X-Frame-Options, HSTS) | Clickjacking, script injection |
| S7 | WalletConnect projectId hardcoded in source | Should be env variable |
| S8 | No rate limiting on auth endpoints | Brute-force attacks |

### Medium Findings

| ID | Finding | Impact |
|----|---------|--------|
| S9 | Password validation missing special char requirement | Weak passwords accepted |
| S10 | Email validation regex is permissive | Loose email validation |
| S11 | Full name input has no max length or character restriction | Potential abuse |

### Low Findings

| ID | Finding | Impact |
|----|---------|--------|
| S12 | Logout does not invalidate server session | Stolen tokens remain valid |
| S13 | No `maxLength` on any form inputs | Client-side resource abuse |
| S14 | Predictable user/order IDs (`Date.now()`) | IDOR risk when real API exists |

### OWASP Top 10 Compliance

| Category | Status |
|----------|--------|
| A01: Broken Access Control | FAIL (S2, S3) |
| A02: Cryptographic Failures | FAIL (S4) |
| A03: Injection | PASS (React JSX escapes) |
| A04: Insecure Design | FAIL (S2, S8) |
| A05: Security Misconfiguration | FAIL (S6) |
| A07: Auth Failures | FAIL (S8, S9) |
| A08: Data Integrity Failures | FAIL (S1) |
| A09: Logging & Monitoring | FAIL (no logging) |

### Remediation Priority

1. Implement `middleware.ts` with server-side auth check
2. Move auth token to httpOnly cookie
3. Move `/payment` inside `(dashboard)` route group
4. Add security headers in `next.config.ts`
5. Move WalletConnect projectId to env variable
6. Remove hardcoded credentials from production builds

---

## 3. Performance

### Critical Issues

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| P1 | Every component is `"use client"` — no server rendering benefits | Increased TTI, larger JS bundle | Medium |
| P2 | Viem ships ~2 MB of chain definitions (app uses only 4 chains) | Unnecessary bundle bloat | Medium |
| P3 | Wallet libraries (RainbowKit, WalletConnect, ~3-5 MB) load on every page including auth pages | Auth pages download megabytes of unused wallet code | Medium |
| P4 | `QueryClient` instantiated at module scope — potential SSR data leakage | Cross-request contamination | Low |

### Optimization Opportunities

| ID | Issue | Priority |
|----|-------|----------|
| P5 | Zustand selectors inconsistently used — `useAuthStore()` without selector in layout causes full re-renders | Medium |
| P6 | `useMint`/`useRedeem` compute derived values on every render without `useMemo` | Medium |
| P7 | Missing `experimental.optimizePackageImports` in next.config.ts for lucide-react, radix-ui | Medium |
| P8 | Home page redirect is client-side (`useEffect`) instead of server-side | Low |
| P9 | Transaction page has no pagination/virtualization — will be slow with real data | Medium |
| P10 | TanStack Query `staleTime` should be per-query (bank accounts: 5min, transactions: 1min) | Low |

### Recommended Actions

| Priority | Action |
|----------|--------|
| P0 | Dynamic import wallet providers; split auth vs dashboard provider trees |
| P0 | Remove `"use client"` from AuthLayout, Logo, and static layout files |
| P1 | Add `experimental.optimizePackageImports` for large packages |
| P1 | Fix Zustand selectors to use `useShallow` or specific field selectors |
| P1 | Move `QueryClient` into `useState` inside Providers component |
| P2 | Add pagination to transactions page before connecting to real API |

---

## 4. Code Patterns & Quality

### Strengths

- Consistent naming conventions (PascalCase components, camelCase hooks/utils, `use` prefix, `validate` prefix, `mock` prefix)
- TypeScript strict mode with zero `any` types
- Centralized validation with uniform `string | null` contract
- Clean import ordering: framework → third-party → internal → relative
- No TODO/FIXME/HACK comments
- Well-documented via CLAUDE.md files

### Pattern Violations

| ID | Issue | Severity | Files |
|----|-------|----------|-------|
| Q1 | **Header, ProfilePage, PaymentPage, MintPage, RedeemPage bypass hook layer** — access stores directly instead of through hooks | High | `Header.tsx:22`, `profile/page.tsx:8`, `payment/page.tsx:15`, `mint/page.tsx:9`, `redeem/page.tsx:9` |
| Q2 | **Duplicate logout logic** — Header reimplements logout instead of using `useAuth().logout` | Medium | `Header.tsx:30-33` vs `useAuth.ts:29-32` |
| Q3 | **`useMint`/`useRedeem` spread entire store** — `return { ...store }` leaks store internals, consumers can bypass hook actions | Medium | `useMint.ts:55`, `useRedeem.ts:53` |
| Q4 | **`MINTING_FEE_PERCENT` used for both mint and redeem fees** — misleading name | Medium | `constants.ts:6`, `useRedeem.ts:8` |
| Q5 | **Fee hardcoded as `0.007` in mock-api** instead of using constant | Medium | `mock-api.ts:169,184` |
| Q6 | **Inconsistent error state typing** — login uses `{ email?: string }`, register uses `Record<string, string | undefined>` | Low | `login/page.tsx:16`, `register/page.tsx:22` |
| Q7 | **Inconsistent error margin** — MintForm uses `mt-1`, RedeemForm does not | Low | `MintForm.tsx:46`, `RedeemForm.tsx:76` |
| Q8 | **Duplicate import from same module** | Low | `payment/page.tsx:9-10` |
| Q9 | **Empty string wallet address passed to redeem API** when wallet not connected | High | `RedeemReview.tsx:119` |

### Code Duplication (Mint ↔ Redeem)

6 duplicated UI blocks identified across mint/redeem:

1. **Amount + ChainSelector input row** (~12 lines each)
2. **USD display row** (disabled input + $ icon + "USD") (~16 lines each)
3. **Exchange rate display** (identical markup) (~6 lines each)
4. **Review button** (same styling, same ArrowRight icon) (~7 lines each)
5. **Review detail rows** (label/value layout pattern) (~5 lines per row, multiple rows)
6. **Back/Change Amount button** (identical) (~7 lines each)

**Recommendation**: Extract shared components: `<AmountChainInput>`, `<UsdDisplay>`, `<ExchangeRate>`, `<ReviewRow>`.

---

## 5. Code Simplicity

### Dead Code to Remove (~217 lines)

| File | What | Lines |
|------|------|-------|
| `src/hooks/useChainSelector.ts` | Entire file — never imported | 23 |
| `src/components/ui/separator.tsx` | Unused UI component | 28 |
| `src/components/ui/tabs.tsx` | Unused UI component | 91 |
| `src/types/index.ts` | `MintFormData`, `RedeemFormData` — never imported | 11 |
| `src/lib/constants.ts` | `EXCHANGE_RATE`, `BRAND_COLOR`, `APP_NAME` — unused | 3 |
| `src/lib/utils.ts` | `formatUSD` — only used in tests, not app code | 8 |
| `src/components/layout/Sidebar.tsx` | `export { navItems }` — never imported | 1 |
| `package.json` | `next-themes` dependency — no ThemeProvider exists | dep |

### YAGNI Violations (Speculative UI for non-existent features)

| Location | Feature | Lines |
|----------|---------|-------|
| `login/page.tsx` | "Google" / "Web3 Wallet" disabled buttons | 20 |
| `MintForm.tsx` | "Add Address Book" link + QR scan icon | 10 |
| `RedeemForm.tsx` | "Add new recipient" button | 4 |
| `payment/page.tsx` | Payment method buttons (non-functional) | 12 |
| `Header.tsx` | "EN" language indicator | 3 |

### Simplification Opportunities

1. Remove `EXCHANGE_RATE` constant (always 1 for a stablecoin) — simplify math to just `parsedAmount`
2. Remove `useAuth` return of `user`/`isAuthenticated` — no caller uses them
3. Consider `useChainSelector` hook is dead code — delete or wire into `ChainSelector`

---

## 6. Consolidated Action Items

### Before Production (Critical)

| # | Action | Category | Files |
|---|--------|----------|-------|
| 1 | Add `middleware.ts` for server-side route protection | Security | New file |
| 2 | Move auth token to httpOnly cookie | Security | `authStore.ts`, backend |
| 3 | Move `/payment` inside `(dashboard)` route group | Security + Arch | `src/app/payment/` |
| 4 | Add security headers in `next.config.ts` | Security | `next.config.ts` |
| 5 | Move WalletConnect projectId to env variable | Security | `Providers.tsx` |
| 6 | Fix empty string wallet address in redeem | Quality | `RedeemReview.tsx:119` |
| 7 | Dynamic import wallet providers for auth pages | Performance | `Providers.tsx` |

### High Priority (Next Sprint)

| # | Action | Category |
|---|--------|----------|
| 8 | Components should use hooks, not stores directly (5 violations) | Patterns |
| 9 | Consolidate logout logic into `useAuth` only | Patterns |
| 10 | Fix Zustand selectors (use `useShallow` or specific selectors) | Performance |
| 11 | Move `QueryClient` into `useState` | Performance |
| 12 | Add `experimental.optimizePackageImports` | Performance |
| 13 | Unify chain configurations (Wagmi ↔ app chains) | Architecture |
| 14 | Delete dead code: `useChainSelector`, unused UI components, unused types | Simplicity |

### Medium Priority (Refactor)

| # | Action | Category |
|---|--------|----------|
| 15 | Extract shared components from mint/redeem duplication | Patterns |
| 16 | Add separate `REDEEM_FEE_PERCENT` constant | Patterns |
| 17 | Use `MINTING_FEE_PERCENT` constant in mock-api (not hardcoded 0.007) | Patterns |
| 18 | Invalidate transactions query after mint/redeem mutations | Architecture |
| 19 | Add pagination to transactions page | Performance |
| 20 | Remove YAGNI UI (disabled buttons, non-functional links) | Simplicity |
| 21 | Strengthen password validation (special chars, max length) | Security |

### Low Priority (Polish)

| # | Action | Category |
|---|--------|----------|
| 22 | Derive `isAuthenticated` instead of storing it | Architecture |
| 23 | Stop spreading store state in hooks (`...store`) | Patterns |
| 24 | Consistent error message margins | Patterns |
| 25 | Use Zustand's `onRehydrateStorage` for hydration check | Patterns |
| 26 | Server-side redirect for root `/` page | Performance |
| 27 | Add input `maxLength` attributes | Security |
| 28 | Use crypto UUIDs instead of `Date.now()` for IDs | Security |

---

## What Was Done Well

- Clean layered architecture with clear separation of concerns
- TypeScript strict mode with zero `any` types
- Consistent naming conventions across the entire codebase
- Zustand stores are minimal and focused
- Multi-step form state machine is cleanly implemented
- Mock API layer is well-abstracted and easy to swap
- Comprehensive test coverage: 83 unit + 33 integration + 9 e2e
- Thorough CLAUDE.md documentation at every level
- No technical debt markers (TODO/FIXME/HACK)
