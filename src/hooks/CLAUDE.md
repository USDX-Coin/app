# src/hooks — Custom React Hooks

Significant reusable hooks that orchestrate state, validation, calculations, and API calls.

## Hooks

| Hook | Store | Query/Mutation | Purpose |
|------|-------|---------------|---------|
| `useAuth` | `authStore` | `useMutation` (login, register) | Auth flow + router redirect. Login lands on `/mint`, or on the screen of a pending re-login intent (`lib/auth/relogin-intent`, USDX-697) |
| `useRelogin` | `authStore` (logout) | — | The "Login ulang" button (USDX-697, shared with 696): mark the intent in sessionStorage → revoke this session (fire-and-forget) → clear the store → `/login`. The next login is the fresh password-auth session `pin.yaml § set` asks for |
| `useMint` | `mintStore` | `useMutation` (createMint) | Mint form logic, rupiah-based minimum, fee calc |
| `useAppConfig` | — | `useQuery` (`GET /api/v2/config`) | Runtime config: mint minimum (IDR), fee rates, token address, mint mode, and whether the redeem payout is simulated (`redeemPayoutSimulated`, tri-state `true/false/null` — USDX-683). Numbers are `null` — never a guessed default — until it loads (USDX-635/638) |
| `useMintHandoffReset` | `mintStore` | — | Wipes the mint form + Ringkasan when /mint comes back from the cross-origin checkout handoff (bfcache restore or fresh load) |
| `useRedeem` | `redeemStore` | `useMutation` (createRedeem) | Redeem form logic, validation. Burn source (USDX-567): `custodial` (PIN in the body, `burnMode` from the backend, no client burn) or `external` (unchanged self-sign gate) |
| `useTransfer` | `transferStore` | `useMutation` (`POST /api/v2/wallet/transfer`) | Custodial transfer: validation, `Idempotency-Key` once per intent, same-key retry on `409 IDEMPOTENCY_KEY_IN_PROGRESS`, error routing to the PIN dialog vs the Ringkasan (USDX-567). Takes `t` so `mapTransferError` can fill vars. `pinNotSet` is read from the profile copy only; `401 PIN_NOT_SET` corrects it via `usePinSetCorrection(false)` (USDX-651) |
| `usePin` | `authStore` (writes `user.pinSet`) | `useMutation` × 3 (`POST /api/v2/auth/pin/set`, `/change`, and `/set` again as `resetPin` — forgot PIN, USDX-696) | Create / change / reset the account PIN (USDX-651): one cooldown for the shared `pin` lockout, `mapPinError(err, flow)` routes each answer to a field (`current` / `new` / `form`) — on the `reset` flow `REAUTH_REQUIRED` = log in again, success flips `user.pinSet` to `true` at once and invalidates `/auth/me`; stale copies follow the backend (`PIN_NOT_SET` → false; `REAUTH_REQUIRED` → `details.pinSet`, absent = true — `false` keeps the copy false and maps to "log in again" with `relogin: true`, USDX-697). All corrections go through `usePinSetCorrection` |
| `usePinSetCorrection` | `authStore` + query cache | — | The one writer of a `user.pinSet` correction (usePin / useTransfer / useRedeem): store AND the `["session","me"]` cache, so reopening a `useSession` screen cannot write a stale cached /auth/me back (USDX-651, `custodial-wallet.md` §5.1) |
| `useWalletBalance` | — | on-chain `balanceOf` (wagmi) | Real USDX balance of the connected wallet — the app's only balance surface API (USDX-396). Token address comes from `useAppConfig`, env only as fallback; in `mintMode: TEST` the main balance **stays** the production token and the test token is reported separately as `testBalance` (USDX-640) |
| `useCustodialWallet` | `authStore` (reads/syncs `user.custodialWallet`) | `useQuery` (`GET /api/v2/wallet`) + `useMutation` (`POST /api/v2/wallet`) | Custodial wallet (USDX-566): status/address/balance + create/retry. GET runs only when the profile says there is a wallet; polls while PROVISIONING with a capped window (`provisioningTimedOut` → retry = repeat POST); `balanceUsdx` is null when the backend gave null, never 0. USDX-567 adds the derived fields the money screens read: `hasWallet`, `address`, `isActive`, `balanceState`, `pinSet`, `invalidate()` |
| `useTransactions` | — | `useQuery` (transactions) | Transaction history list |
| `useWalletTransfers` | — | `useQuery` (`GET /api/v2/wallet/transfers`) | Custodial transfer history (USDX-701): page/take, `keepPreviousData`, paginated envelope; 429 → waits `Retry-After` (≤ 2 retries) before the error state. `WALLET_TRANSFERS_KEY` is invalidated by `useTransfer` after a broadcast and by the tracker on its first final status, so a fresh cache never hides a new transfer (review app#79) |
| `useWalletTransferTracker` | — | `useQuery` (`GET /api/v2/wallet/transfers/{id}`) | Confirmation tracker (USDX-701): polls every 3 s (`TRANSFER_POLL_MS`), stops at CONFIRMED/FAILED and on unmount, 429 → `Retry-After` (≥ 3 s), 404 `WALLET_TRANSFER_NOT_FOUND` / 422 → `notFound` with no retry. No age limit — a long PENDING stays PENDING. `status` is normalised (unknown → PENDING) |
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
