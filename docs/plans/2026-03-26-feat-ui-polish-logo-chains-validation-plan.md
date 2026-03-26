---
title: "feat: UI Polish — Logo, Chain Icons, Validation, Colors, Tables"
type: feat
status: active
date: 2026-03-26
---

# feat: UI Polish — Logo, Chain Icons, Validation, Colors, Tables

## Overview

Comprehensive UI polish pass to make the USDX app look production-ready for investor demo. Updates chain list to match available icons, implements Logo.svg everywhere, adds subtle inline validation, applies gradient + primary color scheme, replaces show/hide text with eye icon, and polishes tables and forms.

## Resolved Decisions

| Decision | Choice |
|----------|--------|
| Chain list | Update to match icons: Base, Polygon, BSC, Ethereum, Avalanche, Optimism, Solana, Arbitrum |
| Solana | UI-only — shown in chain selector but NOT in Wagmi config |
| Error style | Inline subtle — red text below field with fade-in animation |
| Color scheme | Gradients + primary #1EAED5 |
| Logo | Everywhere — header, auth panel, favicon, mobile menu, payment |
| Password toggle | Eye/EyeOff icon from lucide-react |

## Implementation Phases

### Phase 1: Update Chain List + Icons

**Goal:** Chain selector shows 8 chains that match the available SVG icons.

**Files to change:**

**`src/lib/chains.ts`**
- Replace SUPPORTED_CHAINS array with 8 chains matching icons:
  ```
  base      → /icon/base.svg
  polygon   → /icon/polygon.svg
  bsc       → /icon/bnb.svg
  ethereum  → /icon/ethereum.svg
  avalanche → /icon/avalanche.svg
  optimism  → /icon/optimism.svg
  solana    → /icon/solana.svg
  arbitrum  → /icon/arbitrum.svg
  ```
- Remove lisk, etherlink, kaia, monad
- DEFAULT_CHAIN_ID stays "base"

**`src/providers/WalletProviders.tsx`**
- Remove custom etherlink, kaia, monad chain definitions
- Add optimism, arbitrum from `wagmi/chains`
- Add avalanche from `wagmi/chains` (if available, otherwise custom)
- Solana NOT added to Wagmi (UI-only)
- Wagmi chains: base, polygon, bsc, ethereum (mainnet), avalanche, optimism, arbitrum

**`src/components/shared/ChainSelector.tsx`**
- Update ChainIcon component to render actual SVG images using `<img>` tag with chain.icon path
- Remove the letter-initial fallback circle (all chains now have icons)

**`src/lib/api/mock-api.ts`**
- Update mock transaction chainIds to use new chain IDs

**`tests/unit/lib/chains.test.ts`**
- Update: 8 chains, new chain IDs
- Update: Solana present but non-EVM

**`tests/unit/validations.test.ts`**
- Add Solana address test back (UI accepts Solana addresses now since Solana is in chain list)

**`src/lib/validations.ts`**
- Add Solana address validation back (since Solana is in the chain list again)

**Commit:** `feat(chains): update chain list to match icon assets`

---

### Phase 2: Implement Logo.svg Everywhere

**Goal:** USDX Logo.svg replaces text-based logos across the app.

**Files to change:**

**`src/components/layout/Logo.tsx`**
- Replace the dollar-sign circle + "USDX" text with `<img src="/image/Logo.svg">` + "USDX" text
- Keep accepting className prop for sizing

**`src/components/layout/AuthLayout.tsx`**
- Replace the `$` icon in the branding panel with Logo.svg
- Replace mobile-only Logo with Logo.svg

**`src/components/layout/Header.tsx`**
- Logo component already used — will auto-update via Logo.tsx change

**`src/app/payment/page.tsx`**
- Add Logo.svg at top of payment card

**`src/app/(dashboard)/layout.tsx`**
- Mobile Sheet menu header: replace "USDX" text with Logo component

**`src/app/layout.tsx`**
- Add favicon link using Logo.svg (or create a simplified favicon)

**Commit:** `feat(logo): implement Logo.svg across all pages`

---

### Phase 3: Inline Subtle Error Validation

**Goal:** Replace rigid error messages with smooth, user-friendly inline errors.

**Files to change:**

**`src/app/globals.css`**
- Add fade-in animation keyframe:
  ```css
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  ```
- Add utility class `.animate-fade-in { animation: fadeIn 0.2s ease-out; }`

**`src/components/auth/LoginForm.tsx`**
- Replace raw `<p className="text-sm text-destructive">` with styled error component
- Add `animate-fade-in` class to error messages
- Add warning icon (AlertCircle from lucide) before error text
- Style: `text-xs text-destructive flex items-center gap-1.5 mt-1 animate-fade-in`

**`src/components/auth/RegisterForm.tsx`**
- Same error styling pattern as LoginForm
- Apply to all 4 field errors (fullName, email, password, confirmPassword)

**`src/components/auth/ForgotPasswordForm.tsx`**
- Same error styling for email field

**`src/components/mint/MintForm.tsx`**
- Apply consistent error styling for amountError and addressError

**`src/components/redeem/RedeemForm.tsx`**
- Apply consistent error styling for amountError

**Pattern for all error messages:**
```tsx
{error && (
  <p className="text-xs text-destructive flex items-center gap-1.5 mt-1 animate-fade-in">
    <AlertCircle className="h-3 w-3 shrink-0" />
    {error}
  </p>
)}
```

**Commit:** `feat(ui): add subtle inline error validation with fade-in`

---

### Phase 4: Eye Icon for Password Toggle

**Goal:** Replace "Show"/"Hide" text with Eye/EyeOff icons.

**Files to change:**

**`src/components/auth/LoginForm.tsx`**
- Import `Eye`, `EyeOff` from lucide-react
- Replace text button with icon button:
  ```tsx
  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
  ```

**`src/components/auth/RegisterForm.tsx`**
- Add show/hide toggle to password field (currently has none)
- Add show/hide toggle to confirm password field

**Commit:** `feat(auth): replace show/hide text with eye icons`

---

### Phase 5: Gradient + Primary Color Polish

**Goal:** Apply modern gradient accents throughout the app.

**Files to change:**

**`src/app/globals.css`**
- Add gradient utility variables:
  ```css
  --gradient-primary: linear-gradient(135deg, #1EAED5 0%, #0D8CB0 100%);
  --gradient-primary-light: linear-gradient(135deg, #E8F7FC 0%, #D1EFF8 100%);
  ```

**`src/components/layout/AuthLayout.tsx`**
- Update left panel gradient from `bg-gradient-to-br from-primary-500 to-primary-700` to use the new refined gradient

**`src/components/auth/LoginForm.tsx`** + **`RegisterForm.tsx`**
- Login/Register button: apply gradient background instead of flat `bg-primary`
- Style: `bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700`

**`src/components/mint/MintForm.tsx`**
- "Review Mint" button: gradient style
- Amount input area: subtle gradient background `bg-gradient-to-b from-white to-primary-50/30`

**`src/components/mint/MintReview.tsx`**
- "Proceed Payment" button: gradient
- Total payment row: subtle highlight with `bg-primary-50/50`

**`src/components/redeem/RedeemForm.tsx`**
- "Review Redeem" button: gradient
- Similar subtle gradient accents

**`src/components/redeem/RedeemReview.tsx`**
- Consistent gradient button styling

**`src/app/payment/page.tsx`**
- "Pay" button: gradient
- Payment summary header: subtle gradient

**`src/components/layout/Sidebar.tsx`**
- Active nav item: subtle gradient background instead of flat color
- `bg-gradient-to-r from-primary-50 to-transparent text-primary`

**Commit:** `feat(ui): apply gradient color scheme across app`

---

### Phase 6: Polish Tables and Forms

**Goal:** Make transaction table and forms look professional and not rigid.

**Files to change:**

**`src/components/transactions/TransactionList.tsx`**
- Desktop table:
  - Add `hover:bg-muted/50 transition-colors` on table rows
  - Rounded status badges with softer colors
  - Alternating row colors: `even:bg-muted/20`
  - Better typography: transaction type uses pill/badge style
  - Amount column: right-aligned, monospace font
  - Add subtle border-radius to table container
- Mobile cards:
  - Add subtle shadow: `shadow-sm hover:shadow-md transition-shadow`
  - Better spacing and visual hierarchy
  - Type badge with colored background

**`src/components/mint/MintForm.tsx`** + **`RedeemForm.tsx`**
- Input fields:
  - Consistent `rounded-xl` border radius
  - Focus state: `focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary`
  - Placeholder text styling more subtle
- Labels: `text-sm font-medium text-foreground`
- Card sections: subtle gradient backgrounds

**`src/components/mint/MintPageContent.tsx`** + **`RedeemPageContent.tsx`**
- Card containers: add `shadow-sm` for depth
- "Please Note" section: softer styling with left border accent

**`src/components/profile/ProfileCard.tsx`**
- Add subtle card shadow
- Better section dividers

**Commit:** `feat(ui): polish tables, forms, and cards`

---

### Phase 7: Update Tests + Verify

**Goal:** All tests pass, verify with agent-browser.

**Files to change:**
- `tests/unit/lib/chains.test.ts` — 8 chains, new IDs
- `tests/unit/validations.test.ts` — Solana address validation restored
- `tests/integration/mint.spec.ts` — Chain name assertions if changed
- Run full test suite: `pnpm test && pnpm test:integration && pnpm test:e2e`
- Agent-browser verification on all pages at desktop + mobile viewports

**Commit:** `test: update tests for new chains and UI changes`

---

## Acceptance Criteria

### Functional
- [ ] Chain selector shows 8 chains with proper SVG icons
- [ ] Solana visible in chain selector but NOT in Wagmi config
- [ ] Logo.svg displayed in: header, auth branding panel, mobile menu, payment page
- [ ] Password fields use Eye/EyeOff icons (login + register)
- [ ] Validation errors show with fade-in animation and warning icon
- [ ] Buttons use gradient style (not flat color)
- [ ] Transaction table has hover effects, alternating rows
- [ ] Mobile cards have shadow and better visual hierarchy
- [ ] Sidebar active state uses gradient

### Quality
- [ ] All unit tests pass (142+)
- [ ] All integration tests pass (43+)
- [ ] All E2E tests pass (11+)
- [ ] Build succeeds without SSR errors
- [ ] Lint passes
- [ ] No duplicate or redundant code

## Sources

- Chain icons: `public/icon/*.svg` (8 files)
- Logo: `public/image/Logo.svg`
- Brand color: `#1EAED5` (defined in globals.css)
- Current components: `src/components/` (auth/, layout/, mint/, redeem/, transactions/)
