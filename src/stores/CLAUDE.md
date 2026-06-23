# src/stores — Zustand State Management

Client-side state stores using Zustand 5.

## Stores

| Store | Persisted | State |
|-------|-----------|-------|
| `authStore` | Yes (localStorage `usdx-auth`) | `user`, `token`, `isAuthenticated` |
| `mintStore` | No | `step`, `chainId`, `amount`, `destinationAddress` |
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

## Step Types

- **Mint**: `"form" | "review" | "payment"`
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
