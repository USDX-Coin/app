# src/stores — Zustand State Management

Client-side state stores using Zustand 5.

## Stores

| Store | Persisted | State |
|-------|-----------|-------|
| `authStore` | Yes (localStorage `usdx-auth`) | `user`, `token`, `isAuthenticated` |
| `mintStore` | No | `step`, `chainId`, `amount`, `destinationAddress` |
| `redeemStore` | No | `step`, `chainId`, `amount`, `bankAccountId` |

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
- **Redeem**: `"form" | "review" | "executing" | "success"`

Step transitions are controlled by hooks (`useMint`, `useRedeem`), not by components directly.

## Testing

Reset stores in `beforeEach`:
```typescript
beforeEach(() => {
  useStore.getState().reset();
});
```

Access state directly via `useStore.getState()` — no need to render components.
