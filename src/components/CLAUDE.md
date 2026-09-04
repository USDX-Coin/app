# src/components — React Components

## Structure

```
components/
  ui/          # Design system. OURS — hand-written wrappers, meant to be edited.
  animate-ui/  # Animate UI primitives (motion + Radix). Registry files, edit sparingly.
  layout/      # App layout: AuthLayout, Sidebar, Logo, ThemeToggle
  shared/      # Cross-feature: PageHeader, ComingSoonPage, RouteErrorState
  auth/        # Login, Register, Forgot/Reset password, CheckEmail, VerifyEmail
  kyc/         # KYC form: identity + CDD blocks, document dropzones
  mint/        # Mint flow: MintForm, MintReview, ChainSelector
  redeem/      # Redeem flow: RedeemForm, RedeemReview, RedeemStatus (tracker), BankSelect, BankAccountPicker + AddBankAccountModal (bank book, USDX-261)
  transactions/ profile/ bridge/ send/ system/
```

## Conventions

- All feature components are `"use client"` (client components)
- Components consume hooks, not stores directly
- Props interfaces named `{Component}Props`
- Named exports (not default) for non-page components
- Error messages rendered conditionally: `{error && <p>{error}</p>}`

## Shared Components

- **ChainSelector** (`mint/ChainSelector.tsx`) — used by both Mint and Redeem. Dialog with search, chain grid, chain list. Props: `selectedChainId`, `onSelect`.
- **ui/** — the design system, rebuilt in PR 2 (September 2026). These started from
  shadcn (New York) but are now **our own wrappers**: they carry the control scale
  (32/40/44), the five Button variants (`brand` `outline` `ghost` `destructive` `link` —
  shadcn's `default` was deleted), the contrast-checked tokens, and the spring presets
  from `lib/motion.ts`.

  **Do NOT re-run `pnpm dlx shadcn@latest add <component>` on a component that already
  exists** — it overwrites the wrapper and silently takes every one of those decisions
  with it. Adding a component that does not exist yet is fine.

  Prop values are English even though Figma names them in Indonesian:
  `tone="success|warning|info|danger|neutral|coming-soon"`, `shape="block|strip"`,
  `kind="empty|filter|error|offline"`.

  One rule learned the hard way: **a component whose width is decided by its own content
  must never be a `@container`.** Size containment makes it resolve against content already
  treated as empty, so it collapses to 0px. `StatusBadge` and `TableCell` both shipped that
  bug and it is invisible in code review — only measurement in a real browser catches it.

## Layout

- **AuthLayout** — Split screen: left branding panel (hidden on mobile), right form area
- **DashboardLayout** — Sidebar (desktop) + Sheet (mobile) + content area. There is no
  separate Header component: the account switcher lives at the bottom of the Sidebar, and
  the mobile drawer reuses that same Sidebar inside a Sheet. `Header.tsx` and
  `BottomNav.tsx` were deleted in PR 2 — both had zero importers.
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
