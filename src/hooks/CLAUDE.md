# src/hooks — Custom React Hooks

Significant reusable hooks that orchestrate state, validation, calculations, and API calls.

## Hooks

| Hook | Store | Query/Mutation | Purpose |
|------|-------|---------------|---------|
| `useAuth` | `authStore` | `useMutation` (login, register) | Auth flow + router redirect |
| `useMint` | `mintStore` | `useMutation` (createMint) | Mint form logic, rupiah-based minimum, fee calc |
| `useAppConfig` | — | `useQuery` (`GET /api/v2/config`) | Runtime config: mint minimum (IDR), fee rates, token address, mint mode. Numbers are `null` — never a guessed default — until it loads (USDX-635/638) |
| `useMintHandoffReset` | `mintStore` | — | Wipes the mint form + Ringkasan when /mint comes back from the cross-origin checkout handoff (bfcache restore or fresh load) |
| `useRedeem` | `redeemStore` | `useMutation` (createRedeem) | Redeem form logic, validation |
| `useWalletBalance` | — | on-chain `balanceOf` (wagmi) | Real USDX balance of the connected wallet — the app's only balance surface API (USDX-396). Token address comes from `useAppConfig`, env only as fallback; in `mintMode: TEST` the main balance **stays** the production token and the test token is reported separately as `testBalance` (USDX-640) |
| `useCustodialWallet` | `authStore` (reads/syncs `user.custodialWallet`) | `useQuery` (`GET /api/v2/wallet`) + `useMutation` (`POST /api/v2/wallet`) | Custodial wallet (USDX-566): status/address/balance + create/retry. GET runs only when the profile says there is a wallet; polls while PROVISIONING with a capped window (`provisioningTimedOut` → retry = repeat POST); `balanceUsdx` is null when the backend gave null, never 0 |
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
