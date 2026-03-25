# tests — Test Suites

## Running Tests

```bash
pnpm test              # Unit tests (Vitest, ~1s)
pnpm test:integration  # Integration tests (Playwright, ~40s, builds production first)
pnpm test:e2e          # E2E tests (Playwright, ~20s, builds production first)
```

## Structure

```
tests/
  setup.ts              # Vitest setup (jest-dom matchers)
  unit/                 # Vitest — pure business logic
    validations.test.ts # validateEmail, validatePassword, validateAmount, validateAddress
    utils.test.ts       # formatAmount, formatUSD, truncateAddress, parseAmount
    stores/             # Zustand store state transitions
  integration/          # Playwright — page-level interactions
    login.spec.ts       # Login form, validation errors, credentials
    register.spec.ts    # Registration form, password rules
    mint.spec.ts        # Mint form, chain selector, review panel
    transactions.spec.ts # Transaction table rendering
    profile.spec.ts     # User info display
  e2e/                  # Playwright — full user flows
    auth-flow.spec.ts   # Register -> logout -> login
    mint-flow.spec.ts   # Login -> mint -> review -> payment -> success
    redeem-flow.spec.ts # Login -> redeem -> connect wallet prompt
```

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
- Unit tests mock all data — no network, no DOM rendering for store tests
- Playwright tests use `{ timeout: 15000 }` on key assertions for SSR hydration
- `type="email"` inputs have native browser validation — test with valid-format emails
- WalletConnect produces harmless `indexedDB` SSR warnings in test output
