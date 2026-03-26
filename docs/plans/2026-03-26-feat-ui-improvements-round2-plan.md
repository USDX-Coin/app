---
title: "feat: UI Improvements Round 2 — Layout, Validation, Tables, Polish"
type: feat
status: active
date: 2026-03-26
---

# feat: UI Improvements Round 2

## Overview

10 UI improvement tasks to make the USDX app investor-ready. Covers login logo, zero-shift error validation, sidebar layout, profile polish, form field consistency, button consistency, bank account overlay, info tooltips, and a professional transaction table with TanStack Table.

## Resolved Decisions

| Decision | Choice |
|----------|--------|
| Error validation | Reserved space — min-height per field, zero layout shift |
| Transaction table | TanStack Table (client-side sort/search/pagination) |
| Table colors | Subtle brand tint — header bg-primary-50, alternating rows |
| Date format | Formal English: "March 26, 2026" (`toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })`) |

---

## Implementation Phases

### Phase 1: Login Logo + Auth Error Validation (Tasks 1, 2)

**Task 1: Enlarge logo, remove background wrapper**

**`src/components/layout/AuthLayout.tsx`**
- Branding panel: remove the `bg-white/20 backdrop-blur-sm` circle wrapper around logo
- Increase logo size from `h-16 w-16` to `h-20 w-20`
- Keep the panel gradient and text below

**Task 2: Reserved-space error validation (zero layout shift)**

Create a reusable error message component to eliminate duplication:

**`src/components/ui/field-error.tsx`** (NEW)
```tsx
import { AlertCircle } from "lucide-react";

export function FieldError({ message }: { message?: string | null }) {
  return (
    <div className="min-h-[20px] mt-1">
      {message && (
        <p className="text-xs text-destructive flex items-center gap-1.5 animate-fade-in">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
```

Apply `<FieldError>` across all forms, replacing inline error `<p>` tags:

- **`src/components/auth/LoginForm.tsx`** — Replace 2 inline errors + loginError alert
- **`src/components/auth/RegisterForm.tsx`** — Replace 4 inline errors + registerError
- **`src/components/auth/ForgotPasswordForm.tsx`** — Replace 1 inline error
- **`src/components/mint/MintForm.tsx`** — Replace 2 inline errors (amountError, addressError)
- **`src/components/redeem/RedeemForm.tsx`** — Replace 1 inline error (amountError)

For the "Invalid email or password" server error, also wrap in FieldError-style container with reserved space.

**Test:** Unit tests still pass. Agent-browser: submit empty login form, verify fields don't shift.
**Commit:** `feat(auth): enlarge logo, add zero-shift error validation`

---

### Phase 2: Sidebar Logo + Dropdown Fix (Task 3)

**Task 3a: Move logo to sidebar area**

**`src/app/(dashboard)/layout.tsx`**
- Desktop sidebar: replace empty `h-16 border-b` spacer div with Logo component
  ```tsx
  <aside>
    <div className="h-16 border-b border-border flex items-center px-4">
      <Logo />
    </div>
    <Sidebar className="flex-1 px-3" />
  </aside>
  ```
- Header: remove Logo from header left side (it's now in sidebar)
- On mobile (no sidebar): keep Logo in header

**`src/components/layout/Header.tsx`**
- Remove `<Logo />` from header on desktop (md+)
- Keep it on mobile (below md) where sidebar is hidden

**Task 3b: Fix dropdown overlay**

**`src/components/layout/Header.tsx`**
- DropdownMenuContent: add solid background, proper shadow, border
  ```tsx
  <DropdownMenuContent
    align="end"
    className="w-44 bg-white border border-border shadow-lg"
  >
  ```
- Ensure menu items have proper hover states

**Test:** Agent-browser: verify logo in sidebar, header clean. Click avatar → dropdown has solid background.
**Commit:** `feat(layout): move logo to sidebar, fix dropdown overlay`

---

### Phase 3: Profile Page Polish (Task 4)

**`src/components/profile/ProfileCard.tsx`**
- Reduce whitespace: change `space-y-6` to `space-y-4`, `p-6` to `p-5`
- Format date: `new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })`
- Add dummy sections to fill space:
  - **Account Settings**: Email preferences toggle (dummy)
  - **Security**: 2FA status (dummy), last login time
  - **Linked Wallets**: show a dummy wallet address
- Use a 2-column grid for info rows on desktop
- Section dividers with subtle `border-t border-border`

**Test:** Agent-browser: verify profile page has less whitespace, date shows "January 1, 2026" format.
**Commit:** `feat(profile): polish layout, formal date format, add dummy sections`

---

### Phase 4: Mint Form Field Consistency (Tasks 5, 6, 9-mint)

**Task 5: Unify field colors in MintForm**

**`src/components/mint/MintForm.tsx`**
- Ensure ALL input containers use the same background: `bg-white` or `bg-muted/30`
- Remove any field-specific color differences
- Disabled payment amount field should be visually distinct but same base color scheme
- Use consistent `rounded-xl border border-border` for all field wrappers

**Task 6: Fix mint review button consistency**

**`src/components/mint/MintReview.tsx`**
- Both buttons (Proceed Payment + Change Amount) should have consistent icon placement
- Primary button: icon on right side
  ```tsx
  <Button className="w-full ...">
    Proceed Payment
    <ArrowRight className="h-5 w-5 ml-2" />
  </Button>
  ```
- Secondary button: icon on left side
  ```tsx
  <Button variant="outline" className="w-full ...">
    <ArrowLeft className="h-5 w-5 mr-2" />
    Change Amount
  </Button>
  ```

**Task 9-mint: Info tooltip on Mint card**

**`src/components/mint/MintPageContent.tsx`**
- Replace non-functional `<Info>` icon with a Tooltip:
  ```tsx
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent>
        <p>Mint USDX by sending USD payment. Tokens are delivered to your wallet within 24 hours.</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
  ```
- Need to install shadcn tooltip: `pnpm dlx shadcn@latest add tooltip`

**Test:** Unit tests pass. Agent-browser: verify consistent field colors, button icons, tooltip appears on hover.
**Commit:** `feat(mint): unify field colors, fix button icons, add info tooltip`

---

### Phase 5: Redeem Form + Bank Account (Tasks 7, 8, 9-redeem)

**Task 7: Unify field colors in RedeemForm**

**`src/components/redeem/RedeemForm.tsx`**
- Same field color consistency as MintForm
- Fix bank account overlay: ensure `SelectContent` has solid background
  ```tsx
  <SelectContent className="bg-white border border-border shadow-lg">
  ```

**Task 7b: Add "Add New Recipient" button/popup**

**`src/components/redeem/BankAccountSelector.tsx`**
- Add a button at the bottom of the bank account select dropdown: "Add New Recipient"
- Clicking opens a simple Dialog with form fields:
  - Bank Name (Input)
  - Account Number (Input)
  - Account Holder (Input)
  - Save button (adds to local state, no backend)

**`src/components/redeem/AddRecipientDialog.tsx`** (NEW)
- Client component with Dialog
- Form with 3 fields
- On save: call a callback, close dialog
- For demo: just show toast "Recipient added" (no persistence needed)

**Task 8: Fix redeem review button consistency**

**`src/components/redeem/RedeemReview.tsx`**
- Same button pattern as mint: primary icon right, secondary icon left

**Task 9-redeem: Info tooltip on Redeem card**

**`src/components/redeem/RedeemPageContent.tsx`**
- Same tooltip pattern as Mint:
  "Redeem USDX tokens back to USD. Funds are transferred to your bank account."

**Test:** Agent-browser: verify field colors, bank overlay solid, Add Recipient dialog works, tooltip.
**Commit:** `feat(redeem): unify fields, fix bank overlay, add recipient dialog, info tooltip`

---

### Phase 6: Transaction Table Upgrade (Task 10)

**Install TanStack Table:**
```bash
pnpm add @tanstack/react-table
```

**`src/components/transactions/TransactionList.tsx`** — Full rewrite

New features:
- **TanStack Table** with column definitions
- **Search input** at top: filter by type, chain, status, hash
- **Sortable columns**: click header to sort (Date, Amount, Type, Status)
- **Pagination**: 10 items per page with page controls
- **Date format**: same formal format as profile (`toLocaleDateString('en-US', ...)`)
- **Clickable tx hash**: links to `chain.explorerUrl/tx/{hash}` in new tab
- **Type badges**: Mint = `bg-primary-100 text-primary-700`, Redeem = `bg-orange-100 text-orange-700`
- **Status badges**: Completed = `bg-green-100 text-green-700`, Pending = `bg-amber-100 text-amber-700`, Failed = `bg-red-100 text-red-700`
- **Table styling** (subtle brand tint):
  - Container: `border border-primary-100 rounded-2xl overflow-hidden`
  - Header: `bg-primary-50 text-primary-900`
  - Row alternate: `even:bg-primary-50/20`
  - Row hover: `hover:bg-primary-50/50`
  - Sort indicator: arrow icon next to active sort column
- **Reduce whitespace**: tighter padding, `py-2.5 px-4` instead of default
- **Mobile cards**: keep existing card layout, add same search input

**`src/app/(dashboard)/transactions/page.tsx`**
- Update heading section with search input
- Less whitespace around heading

**Test:** Unit tests pass. Agent-browser: verify sort, search, pagination, clickable hash, brand-tinted table.
**Commit:** `feat(transactions): TanStack Table with sort, search, pagination, brand colors`

---

### Phase 7: Final Test + Verify

- Run `pnpm test` — all unit tests pass
- Run `pnpm build` — production build succeeds
- Run `pnpm test:integration` — all integration tests pass
- Run `pnpm test:e2e` — all e2e tests pass
- Agent-browser verification: all 10 tasks verified at desktop + mobile viewports
- Fix any failing tests
- Update any test assertions that changed (e.g., chain names in transactions)

**Commit:** `test: update tests for UI improvements round 2`

---

## Acceptance Criteria

### Functional
- [ ] Login: logo enlarged without background wrapper
- [ ] Auth forms: error messages don't cause layout shift (reserved space)
- [ ] Dashboard: logo in sidebar area (not empty space)
- [ ] Dropdown: solid background, not transparent
- [ ] Profile: less whitespace, formal date "March 26, 2026", dummy sections
- [ ] Mint form: consistent field colors across all inputs
- [ ] Mint review: consistent button icons (primary→right, secondary→left)
- [ ] Redeem form: consistent field colors, solid bank overlay
- [ ] Redeem: "Add New Recipient" dialog functional
- [ ] Mint + Redeem: info icon tooltip on hover
- [ ] Transaction table: TanStack Table with sort, search, pagination
- [ ] Transaction table: clickable tx hash → explorer
- [ ] Transaction table: subtle brand tint colors
- [ ] Date format consistent everywhere: "Month Day, Year"

### Quality
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Build succeeds
- [ ] Lint passes
- [ ] No duplicate error message code (use FieldError component)
- [ ] Reusable tooltip pattern (no duplicated tooltip code)

## Dependencies

- **New package:** `@tanstack/react-table` (for Phase 6)
- **New shadcn component:** `tooltip` (for Phase 4-5)
- **New component:** `FieldError` (Phase 1)
- **New component:** `AddRecipientDialog` (Phase 5)

## Files Changed Summary

| Phase | New Files | Modified Files |
|-------|-----------|---------------|
| 1 | `ui/field-error.tsx` | AuthLayout, LoginForm, RegisterForm, ForgotPasswordForm, MintForm, RedeemForm |
| 2 | — | Header, (dashboard)/layout.tsx |
| 3 | — | ProfileCard |
| 4 | — | MintForm, MintReview, MintPageContent + install tooltip |
| 5 | `AddRecipientDialog.tsx` | RedeemForm, BankAccountSelector, RedeemReview, RedeemPageContent |
| 6 | — | TransactionList (rewrite), transactions/page.tsx + install @tanstack/react-table |
| 7 | — | Test files as needed |
