# src/stores — Zustand State Management

Client-side state stores using Zustand 5.

## Stores

| Store | Persisted | State |
|-------|-----------|-------|
| `authStore` | Yes (localStorage `usdx-auth`) | `user`, `token`, `isAuthenticated` |
| `mintStore` | No | `chainId`, `amount`, `amountCurrency`, `destinationAddress`, `reviewOpen`, `handoffPending` |
| `redeemStore` | No | `step`, `amount`, `amountCurrency`, `bankCode`, `bankAccountNumber`, `bankAccountName`, `orderId`, `burnState`, `burnErrorKey` |

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

Step transitions are controlled by hooks (`useMint`, `useRedeem`), not by components directly.

## Testing

Reset stores in `beforeEach`:
```typescript
beforeEach(() => {
  useStore.getState().reset();
});
```

Access state directly via `useStore.getState()` — no need to render components.
