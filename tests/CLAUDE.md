# tests — Test Suites

## Running Tests

```bash
pnpm test              # Unit tests (Vitest, ~1s)
pnpm test:integration  # Integration tests (Playwright, ~40s, builds production first)
pnpm test:e2e          # E2E tests (Playwright, ~20s, builds production first)
pnpm audit:ui          # UI measurement harness (node, needs `pnpm dev` running)
```

## Structure

```
tests/
  setup.ts              # Vitest setup (jest-dom matchers)
  unit/                 # Vitest — pure business logic
    validations.test.ts # validateEmail, validatePassword, validateAmount, validateAddress
    utils.test.ts       # formatAmount, formatUSD, truncateAddress, isSameAddress, parseAmount
    stores/             # Zustand store state transitions
  integration/          # Playwright — page-level interactions
    login.spec.ts       # Login form, validation errors, credentials
    register.spec.ts    # Registration form, password rules
    mint.spec.ts        # Mint form, chain selector, review panel
    transactions.spec.ts # Transaction table rendering
    profile.spec.ts     # User info display
    history-custodial.spec.ts # /history "Wallet custodial saya" marker: to/from the wallet, manual address, no wallet, all-lowercase address, mobile cards (USDX-653)
    transfer-history.spec.ts # Unified /history transfers (USDX-713): tabs + ?type=, incoming vs outgoing rows, detail and back to "Keluar", /send/history redirect, no "Transfer history" button, 10 per page, unknown status = pending, neutral 404 (USDX-701)
    settings-2fa.spec.ts # Settings → Security → 2FA: turn on (QR + backup codes + code), wrong code, turn off with the 24-hour warning, new backup codes with the same warning, copy not stale after /send + /auth/me, 375px ID (USDX-714)
    settings-pin.spec.ts # Settings → Account → transaction PIN: create, use at once on /send, change, lockout (USDX-651); create on a stale session → log in again → back to the dialog (USDX-697); forgot PIN from Change PIN: lockout, 5-minute window, cancel, per tab (USDX-696)
  e2e/                  # Playwright — full user flows
    auth-flow.spec.ts   # Register -> logout -> login
    mint-flow.spec.ts   # Login -> mint -> review -> cross-origin checkout handoff
    redeem-flow.spec.ts # Login -> redeem -> connect wallet prompt
    custodial-wallet-flow.spec.ts # Register -> verify -> /mint -> wallet step -> create -> ACTIVE -> receives USDX -> balance; Settings activation; decline (USDX-566; the mock build has env.walletCreateEnabled ON, USDX-699 — the production pill is unit-tested in CustodialWalletOffer.test)
    transfer-flow.spec.ts         # Custodial transfer: form -> Ringkasan -> PIN -> tracker PENDING -> CONFIRMED/FAILED, stuck stays waiting, row in /history "Keluar" (USDX-567/701/713)
    history-unified-flow.spec.ts  # Unified /history: incoming PENDING -> Successful without reload (15 s refresh), no-wallet user, unknown ?type= (USDX-713)
    redeem-custodial-flow.spec.ts # Custodial redeem: PIN, no wallet dialog, tracker to payout (USDX-567)
    transfer-2fa-flow.spec.ts     # Custodial transfer with 2FA (USDX-717): PIN + authenticator code, backup code, wrong code keeps the PIN, activation card → turn on in place → Send enabled without reload, 24-hour lock banner (on load and as a 409 mid-form), 2fa-stepup lockout sentence ≠ PIN, backend before 718 still sends
    redeem-custodial-2fa-flow.spec.ts # Custodial redeem with 2FA (USDX-717): PIN + code, wrong code stays in the dialog (no logout), activation card, lock banner (on load and as a 409 mid-form), external source untouched
    two-factor-flow.spec.ts       # Login on a 2FA account: code / backup code (single use), forgot-PIN re-login still lands on Settings after the code, email recovery with the 24-hour warning, expired challenge (USDX-714)
    pin-flow.spec.ts              # PIN created from the transfer/redeem notice, stale-copy PIN_NOT_SET (USDX-651); every create door asks to log in again under backend USDX-698 (USDX-697); forgot PIN from a locked transfer PIN dialog → new PIN approves, old refused (USDX-696)
  audit-ui/             # node + Playwright — measurement, NOT assertions
    sweep-auth.js       # Every authed page x 4 viewports: overflow, out-of-bounds
    state-audit.js      # Empty, 500, 401, 429, offline, slow loading
    a11y-audit.js       # Keyboard focus, touch targets, WCAG contrast
    modal-audit.js      # Dialog behaviour: max-height, scroll, focus trap
```

`audit-ui/` is deliberately not a Playwright project: these scripts have **no
assertions**. They measure the rendered page and write numbers to JSON, which is how the
September 2026 audit caught a scroll bug (`scrollHeight 1962` vs `clientHeight 900`) that
both the eye and the spec suites missed. See `tests/audit-ui/README.md`.

## Naming Convention

```
describe('functionOrPage')
  describe('positive')     # Happy path
    test('does X')
  describe('negative')     # Error cases
    test('rejects X')
  describe('edge cases')   # Boundaries, unusual inputs
    test('handles X')
```

## Test Helpers

### Integration/E2E: Auth via localStorage

```typescript
async function loginViaStorage(page) {
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.setItem("usdx-auth", JSON.stringify({
      state: { user: {...}, token: "mock", isAuthenticated: true },
      version: 0,
    }));
  });
}
```

### Unit: Store reset

```typescript
beforeEach(() => {
  useStore.getState().reset();
});
```

## Key Notes

- Integration/E2E use **production build** (`pnpm build && pnpm start`) for speed
- **bfcache specs** (`integration/mint-handoff-return.spec.ts`) need two launch
  overrides, both already in that file: `ignoreDefaultArgs:
  ["--disable-back-forward-cache"]` (Playwright disables bfcache by default) and
  `channel: "chromium"` (the default `chrome-headless-shell` never restores from
  bfcache — verified by probe). A back-navigation that restores from bfcache fires
  no `load` event, so use `goBack({ waitUntil: "commit" })`. Any spec asserting a
  restore must also assert `pageshow.persisted`, otherwise a silent fresh load
  makes it pass while testing nothing
- **Custodial paths** (USDX-567): arm `seedCustodialWallet(page, { status: "ACTIVE", balance, …seams })` AND pass
  `custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY` to `loginViaStorage` — the first render
  reads the persisted profile, the mock `/me` reads the seam; both must agree. Mock PIN is
  `MOCK_PIN` ("123456"); the account PIN is its own seam — `seedAccountPin(page, pin | null)`
  (null = no PIN yet → `401 PIN_NOT_SET`, pair it with `pinSet: false` on `loginViaStorage`),
  applied once per tab because the flow under test creates/changes it (USDX-651).
  The mock plays the backend of USDX-698 by default: with a custodial wallet seeded,
  creating a PIN on the `loginViaStorage` session (stale) is refused with "log in again";
  a login through the form is fresh (USDX-697), and `seedFreshPasswordAuth(page)` stands
  for "logged in moments ago" (also what lets the forgot-PIN overwrite through).
  Transfer history (USDX-701/713): `seedWalletTransfers(page, [WALLET_TRANSFER_FIXTURES.…])`
  fills the outgoing ledger and `seedIncomingTransfers(page, [INCOMING_TRANSFER_FIXTURES.…],
  { confirmAfterMs })` the incoming one, once per tab; both show up in `/history`; `transferOutcome` on `seedCustodialWallet` decides
  what the next sent transfer becomes (default CONFIRMED after 3.5 s). Never arm
  `seedWallet` (the external-wallet seam) in a custodial
  spec: proving "no wallet dialog" needs the external wallet to be absent
- **2FA** (USDX-714): `seedTwoFactor(page, true)` turns the account's 2FA on in the mock (once
  per tab) — pair it with `twoFactorEnabled: true` on `loginViaStorage`. The mock accepts
  `MOCK_TOTP_CODE` / `MOCK_BACKUP_CODES` / `MOCK_RECOVERY_OTP`; `expireTwoFactorChallenge(page)`
  ends the login step-1 challenge while the code screen is open.
  **Custodial transfer/redeem need 2FA since USDX-717**: the mock plays backend 718, so every
  custodial money spec arms `seedTwoFactor(page, true)` + `twoFactorEnabled: true` and fills
  "Authenticator code" with `MOCK_TOTP_CODE`. `seedOutboundLock(page, iso)` = money out on hold
  (24-hour lock), `seedLegacyStepUp(page)` = the backend before 718 (code dropped, no lock)
- Unit tests mock all data — no network, no DOM rendering for store tests
- Playwright tests use `{ timeout: 15000 }` on key assertions for SSR hydration
- `type="email"` inputs have native browser validation — test with valid-format emails
- WalletConnect produces harmless `indexedDB` SSR warnings in test output
