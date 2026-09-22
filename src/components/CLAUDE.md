# src/components — React Components

## Structure

```
components/
  ui/          # Design system. OURS — hand-written wrappers, meant to be edited.
  animate-ui/  # Animate UI primitives (motion + Radix). Registry files, edit sparingly.
  layout/      # App layout: AuthLayout, Sidebar, Logo, ThemeToggle
  shared/      # Cross-feature: PageHeader, PagePagination (server-paginated lists), ComingSoonPage, RouteErrorState, PinConfirmDialog (USDX-567), PinField + PinSetupDialog + PinChangeDialog + PinNotSetNotice (USDX-651), ForgotPinLink (USDX-696)
  auth/        # Login, Register, Forgot/Reset password, CheckEmail, VerifyEmail
  kyc/         # KYC form: identity + CDD blocks, document dropzones
  mint/        # Mint flow: MintForm, MintReview, ChainSelector
  redeem/      # Redeem flow: RedeemForm, RedeemReview, RedeemStatus (tracker), BankSelect, BankAccountPicker + AddBankAccountModal (bank book, USDX-261). Custodial source switch + PIN dialog in the review (USDX-567)
  wallet/      # Custodial wallet (USDX-566): CustodialWalletOffer, CustodialWalletPanel, ReceiveAddress (QR + copy), CustodialWalletSection (offer-or-panel), CustodialBalanceCard (sidebar), WalletOnboardingContent
  settings/    # SettingsPageContent — Pengaturan is a real page since USDX-566; PinSection = the transaction PIN row in the Account card (USDX-651)
  transfer/    # Custodial transfer (USDX-567): TransferPageContent (custodial owner → form, else ComingSoon), TransferForm, TransferReview, TransferResult (= confirmation tracker, USDX-701). History (USDX-701): TransferHistoryList (/send/history), TransferDetail (/send/history/[id]), TransferStatusPanel + TransferStatusBadge (shared by tracker and detail), TransferHistoryLink (/send, /history)
  transactions/ profile/ system/
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

## Custodial money paths (USDX-567)

- **PinConfirmDialog** (`shared/`) is the single approval step for the custodial
  transfer and the custodial redeem — after it there is no wallet signature screen. It
  does not call an API: the caller sends the PIN inside the transfer/redeem body and maps
  `401 INVALID_PIN` / `PIN_NOT_SET` / `429 TOO_MANY_ATTEMPTS` into `errorKey` /
  `pinNotSet` / `cooldownSeconds`. Non-PIN failures close the dialog and show in the
  Ringkasan next to the figures.
- **PIN create / change (USDX-651)** — `PinSetupDialog` (new PIN + repeat, `POST
  /auth/pin/set`) and `PinChangeDialog` (current + new + repeat, `POST /auth/pin/change`)
  own their calls through `hooks/usePin`; both share `PinField` (password + one-time-code
  + numeric, letters dropped, 6 max) with `PinConfirmDialog`. `PinNotSetNotice` is the
  "no PIN yet" alert with a Create PIN button that opens `PinSetupDialog` in place — used
  by `TransferReview`, `RedeemReview` and `PinConfirmDialog`, so the user never leaves
  the transfer/redeem to get a PIN. `401 REAUTH_REQUIRED` with `details.pinSet: false`
  (a custodial-wallet account without a PIN on a stale session, backend USDX-698) shows
  "log in again" + a **Log in again** button (`hooks/useRelogin`) in `PinSetupDialog` —
  every create door gets it; after the login `PinSection` takes the intent and opens the
  dialog (USDX-697). `CustodialWalletSection` shows one `PinNotSetNotice` invite when a
  wallet created on that screen turns ACTIVE on an account without a PIN.
- **Forgot PIN (USDX-696, `custodial-wallet.md` §5.1 "Lupa PIN di web")** — `ForgotPinLink`
  ("Forgot PIN?" → one sentence + **Log in again**, `useRelogin("forgot-pin")`; Cancel leaves
  no marker) sits under the PIN field of `PinConfirmDialog` (not when there is no PIN;
  disabled mid-request) and under the current-PIN field of `PinChangeDialog` — still usable
  during a lockout countdown. After the login `PinSection` takes `forgot-pin` and opens
  `PinSetupDialog variant="reset"` ("Create a new PIN", `usePin.resetPin`) even when the
  account has a PIN. The submit handlers of both dialogs
  `stopPropagation()`: a portal's submit still bubbles through the React tree into
  `PinConfirmDialog`'s `<form>`.
- `mint/MintForm` shows a destination switch (custodial default · another address) only
  when `useMint().custodialAvailable`; `MintReview` marks the recipient "wallet custodial
  saya" by a byte-identical address match — there is no flag on the order.
- `transactions/TransactionList` marks MINT and REDEEM history rows with the mint review's
  own label (`mint.destCustodial`, "Wallet custodial saya") when `tx.userAddress` equals
  `useCustodialWallet().address` **case-insensitively** (`isSameAddress`, `lib/utils.ts`)
  — unlike the review, a stored mint address may be all lowercase. No wallet = no marker
  and no request; never a detail call per row (USDX-653, `custodial-wallet.md` §5.2).
- `redeem/RedeemStatus` hides `BurnGate` for `order.burnMode === "CUSTODIAL"` and shows
  the "sistem sedang memproses burn" strip instead; `useRedeemBurn.runBurn` refuses such
  an order too, so the resume-from-history path cannot trigger a wallet either.

## Redeem tracker states (USDX-661 / USDX-664)

- **Pre-burn destination agreement** — while `AWAITING_BURN` on `SELF_SIGN`, the tracker
  renders the destination from the ORDER RESPONSE (`lib/redeem/destination.ts`:
  `orderDestination`) and disables the burn button until the checkbox is ticked
  (`burnDisabled`). The agreement is stored as the *order id* that was agreed to, so a
  different order opened in the same component never inherits it (proved in
  `tests/unit/components/RedeemStatus.test.tsx`). `useRedeem.submitRedeem` therefore does
  NOT fire the burn any more — the tracker's button does.
- **Holder-name provenance (USDX-672)** — the caption "jawaban bank atas nomor rekening ini"
  is only attached when the order says `bankAccountNameVerified === true`
  (`orderDestination.accountNameVerified`). `false` and a missing field are read the same
  way: show the name, claim nothing about where it came from, still require the agreement.
  The reason is a backend fallback invisible to the client — `inquiry.accountName ??
  bank.bankAccountName` — which makes the displayed name the customer's own typing whenever
  the provider answers no name (always, under provider `MOCK`).
- **`PAYOUT_FAILED`** is not in `STEPS`: it REPLACES the stepper with one warning-tone
  `Alert` (never `danger`, never a retry button — the customer cannot fix it). The tracker
  keeps polling: the status is "waiting for ops", not terminal (`conventions.md § Status
  Enums → Redeem Order`).
