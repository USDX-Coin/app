# src/hooks — Custom React Hooks

Significant reusable hooks that orchestrate state, validation, calculations, and API calls.

## Hooks

| Hook | Store | Query/Mutation | Purpose |
|------|-------|---------------|---------|
| `useAuth` | `authStore` | `useMutation` (login, register) | Auth flow + router redirect |
| `useMint` | `mintStore` | `useMutation` (createMint) | Mint form logic, validation, fee calc |
| `useRedeem` | `redeemStore` | `useMutation` (createRedeem) | Redeem form logic, validation |
| `useWalletBalance` | — | `useQuery` (walletBalance) | Mock wallet balance for connected address |
| `useTransactions` | — | `useQuery` (transactions) | Transaction history list |
| `useChainSelector` | — | — | Chain search/filter state |

## Pattern

Each hook combines:
1. **Zustand store** — raw form state (amount, chainId, step)
2. **Computed values** — `parsedAmount`, `paymentAmount`, `fee`, `selectedChain`
3. **Validation** — `amountError`, `addressError` (from `lib/validations.ts`)
4. **Actions** — `goToReview()`, `goBackToForm()`, `proceedPayment()`
5. **TanStack mutations** — async API calls with loading state

Components should use hooks, not stores directly. Hooks are the public API.

## Adding a New Hook

1. Create `src/hooks/useFeature.ts`
2. Import relevant store from `src/stores/`
3. Import validators from `src/lib/validations.ts`
4. Compute derived values (errors, amounts, selected items)
5. Return spread store + computed values + action functions
