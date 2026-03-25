# src/components — React Components

## Structure

```
components/
  ui/          # shadcn/ui base components (auto-generated, don't edit)
  layout/      # App layout: AuthLayout, Header, Sidebar, Logo
  mint/        # Mint flow: MintForm, MintReview, ChainSelector
  redeem/      # Redeem flow: RedeemForm, RedeemReview, BankAccountSelector
```

## Conventions

- All feature components are `"use client"` (client components)
- Components consume hooks, not stores directly
- Props interfaces named `{Component}Props`
- Named exports (not default) for non-page components
- Error messages rendered conditionally: `{error && <p>{error}</p>}`

## Shared Components

- **ChainSelector** (`mint/ChainSelector.tsx`) — used by both Mint and Redeem. Dialog with search, chain grid, chain list. Props: `selectedChainId`, `onSelect`.
- **ui/** — shadcn/ui components. Initialized with New York style. Do not edit directly; re-run `pnpm dlx shadcn@latest add <component>` to update.

## Layout

- **AuthLayout** — Split screen: left branding panel (hidden on mobile), right form area
- **DashboardLayout** — Sidebar (desktop) + Sheet (mobile) + Header + content area
- **Header** — Logo, EN label, avatar dropdown (Profile, Logout)
- **Sidebar** — Nav links (Mint, Redeem, Transactions) with active state highlight

## Form Components Pattern

1. Get state + actions from hook (`useMint()`, `useRedeem()`)
2. Render inputs with `value` + `onChange` from hook
3. Show validation errors below inputs
4. Disable submit button until `isFormValid`
5. Multi-step: conditionally render Review panel based on `step` state

## Responsive Breakpoints

- Mobile: < `lg` (1024px) — sidebar collapses to Sheet, review panel stacks below form
- Desktop: >= `lg` — sidebar visible, review panel side-by-side with form
