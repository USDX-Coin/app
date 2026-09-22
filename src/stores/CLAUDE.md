# src/stores — Zustand State Management

Client-side state stores using Zustand 5.

## Stores

| Store | Persisted | State |
|-------|-----------|-------|
| `authStore` | Yes (localStorage `usdx-auth`) | `user`, `token`, `isAuthenticated`; `setPinSet(bool)` corrects `user.pinSet` alone (USDX-651: `/pin/set` success → true at once; `401 PIN_NOT_SET` → false) — call it through `hooks/usePinSetCorrection`, which also patches the `/auth/me` cache |
| `mintStore` | No | `chainId`, `amount`, `amountCurrency`, `destinationAddress`, `destinationSource` (`custodial` \| `manual`, USDX-567), `reviewOpen`, `handoffPending` |
| `redeemStore` | No | `step`, `source` (`custodial` \| `external`, USDX-567), `pinOpen`, `amount`, `amountCurrency`, `bankCode`, `bankAccountNumber`, `bankAccountName`, `orderId`, `burnState`, `burnErrorKey` |
| `transferStore` | Partly (sessionStorage `usdx-transfer-intent`: `to`, `amount`, `idempotencyKey` only) | `step` (`form` \| `done`), `to`, `amount`, `reviewOpen`, `pinOpen`, `idempotencyKey`, `result` (USDX-567; `result.id` keys the tracker, USDX-701) |

## Pattern

```typescript
const initialState = { step: "form", chainId: DEFAULT_CHAIN_ID, amount: "" };

export const useStore = create<State>()((set) => ({
  ...initialState,
  setField: (value) => set({ field: value }),
  reset: () => set(initialState),
}));
```

## Hydration

`authStore` uses `persist` middleware. On SSR/first render, state is empty until localStorage hydrates. The dashboard layout waits for hydration with a `hydrated` flag before checking `isAuthenticated`.

## Not Persisted On Purpose

`mintStore` must stay unpersisted. `/mint` ends in a cross-origin handoff to
checkout, and the fresh-load half of the post-handoff cleanup relies on the store
being rebuilt empty on every load — persisting it would replay a paid order's form
after a reload. The bfcache half (Back from checkout, page restored live) is handled
explicitly by `hooks/useMintHandoffReset`, keyed on `handoffPending`.

## Step Types

- **Mint**: no step machine — a single form view plus the `reviewOpen` modal flag
  (the old `"form" | "review" | "payment"` states went away with the checkout handoff,
  USDX-225). `handoffPending` latches once the order is created and the browser is
  leaving for checkout: it keeps the confirm button disabled for the whole navigation
  and marks the page as "wipe me" if it comes back from the back-forward cache.
- **Redeem**: `"form" | "tracker"` (Ringkasan is a modal over the form; `tracker` polls the created order — USDX-243). `burnState` (`idle | submitting | submitted | error`) guards the on-chain burn against double-submit and drives retry (USDX-259); `resumeOrder(id)` opens the tracker for an existing order (resume from /history).

- **Transfer**: `"form" | "done"` — `done` is the confirmation tracker (USDX-701):
  202 is proof of broadcast, and `components/transfer/TransferResult` polls
  `GET /api/v2/wallet/transfers/{result.id}` until CONFIRMED/FAILED. One `result`
  = one tracker, so a 200 replay (same id) never opens a second. `idempotencyKey` is part of the
  contract: minted once per INTENT by `ensureIdempotencyKey()`, reused by every retry,
  and dropped by `setTo`/`setAmount` (a new intent) or `setResult` (intent finished).
  `clearIdempotencyKey()` exists only for `409 IDEMPOTENCY_KEY_REUSED` (an FE bug).
  The intent is persisted to **sessionStorage** so a reload mid-request (the
  "connection lost after broadcast" case the key exists for) reuses the same key
  instead of minting a new one for the same destination + amount.
- `mintStore.destinationSource` / `redeemStore.source` default to `custodial`; the hooks
  ignore that for users without an ACTIVE custodial wallet, so non-custodial behaviour is
  unchanged.

Step transitions are controlled by hooks (`useMint`, `useRedeem`, `useTransfer`), not by components directly.

## Testing

Reset stores in `beforeEach`:
```typescript
beforeEach(() => {
  useStore.getState().reset();
});
```

Access state directly via `useStore.getState()` — no need to render components.
