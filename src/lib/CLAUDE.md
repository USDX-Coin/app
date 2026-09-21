# src/lib — Core Business Logic

Shared utilities, validation rules, constants, chain config, and mock API layer.

## Files

| File | Purpose |
|------|---------|
| `utils.ts` | `cn()`, `formatAmount()`, `formatUSD()`, `truncateAddress()`, `parseAmount()` |
| `validations.ts` | All form validators — return an i18n key or `null`; `translateValidation(t, key)` renders it |
| `constants.ts` | Exchange rate (1:1), redeem min/max, mint ceiling, brand color. The mint MINIMUM is not here — it comes from `GET /api/v2/config` (USDX-638) |
| `chains.ts` | 8 supported chains with id, name, icon, contract address |
| `api/config-api.ts` | `getAppConfig()` → `GET /api/v2/config` — mint minimum (IDR), fee rates, token address, mint mode |
| `uuid.ts` | `uuidv7()` — the `Idempotency-Key` (RFC 9562 v7, time-ordered) |
| `api/mock-api.ts` | Mock backend — login, register, transactions, mint/redeem orders |
| `api/types.ts` | Request DTOs: `LoginRequest`, `RegisterRequest`, `CreateMintRequest`, `CreateRedeemRequest` |

## Validation Pattern

Every validator follows this contract:

```typescript
function validateX(input: string): string | null
// null = valid, string = an i18n KEY ("validation.email.required")
```

The key is turned into a sentence where the language is known:

```typescript
const { t } = useLang();
<FieldHelp error={translateValidation(t, validateEmail(email))} />
```

`translateValidation` also supplies the numbers a message carries (password minimum,
redeem bounds, mint ceiling) from `constants.ts`, so a limit is never copied into the
dictionary. Runtime bounds — the ones the backend owns — are passed as its third
argument instead and win over the static table.

Validators: `validateEmail`, `validatePassword`, `validateAmount`, `validateAddress`, `validateConfirmPassword`, `validateFullName`, `validatePhone`, `validateBankAccountNumber`, `validateBankAccountName`, `validateTransferAddress` (EVM only, not the user's own custodial address), `validateTransferAmount` (positive, ≤ 6 decimals, ≤ the KNOWN balance — `null` balance never blocks). `passwordScore` reports how many password rules are met, for `ui/password-strength.tsx`.

Amount validation accepts a `"mint" | "redeem"` type. Mint additionally takes a
`MintAmountBounds` third argument, because its two limits are in different units: the
minimum is a RUPIAH figure from `GET /api/v2/config` judged on the order subtotal, the
ceiling stays USDX. Without that argument the shape is still checked but **no limit is
invented** — the caller disables the action until the config lands (USDX-638).

Address validation auto-detects EVM (starts with `0x`, 42 chars) vs Solana (base58, 32-44 chars).

## API Layer (USDX-150)

Auth + KYC now route through real-or-mock dispatchers; mint/redeem/transactions are still mock-only (Week 2+).

| File | Purpose |
|------|---------|
| `env.ts` | `NEXT_PUBLIC_API_BASE_URL` + `useMock` flag (mock when no base URL) + `walletCreateEnabled` (the "Buatkan saya wallet" button: explicit `NEXT_PUBLIC_WALLET_CREATE_ENABLED` wins, otherwise ON only in mock or on `https://api-dev.usdx.co.id` — allowlist, fails closed; USDX-699) |
| `api/client.ts` | `apiFetch` — Bearer auth, SoT envelope unwrap, `ApiError`, 401 → `onUnauthorized` |
| `api/errors.ts` | `ApiError` helpers (`isEmailNotVerified`, `getRateLimitSeconds`, …) |
| `api/auth-api.ts` | `login/register/verifyEmail/resend/forgot/reset/getMe/changePassword` → `/api/v2/auth/*` or mock; `setPin/changePin` → `/api/v2/auth/pin/set`, `/change` with `skipUnauthorizedHandler` (401 here is `INVALID_PIN` / `REAUTH_REQUIRED` / `PIN_NOT_SET`, not a dead session) (USDX-651) |
| `api/kyc-api.ts` | `getMyKycStatus/submitKyc/requestPresignedUpload` → `/api/v2/kyc`, `/api/v2/storage` or mock |
| `api/wallet-api.ts` | `getCustodialWallet` (404 `WALLET_NOT_FOUND` → `null`, a normal state) / `createCustodialWallet` (always 202 PROVISIONING) → `/api/v2/wallet` or mock (USDX-566); `transferCustodial(req, idempotencyKey)` → `POST /api/v2/wallet/transfer` with the `Idempotency-Key` header + `skipUnauthorizedHandler` (401 here is `INVALID_PIN`, not a dead session) (USDX-567) |
| `api/mock-api.ts` | In-memory mock backend used when `env.useMock` is true. Demo user: `demo@usdx.com` / `Demo1234` |
| `api/mock-custodial-wallet.ts` | Mock `POST/GET /api/v2/wallet` (USDX-566): PROVISIONING → ACTIVE state machine in localStorage (`usdx-mock-custodial`), `withCustodialWallet` for the profile copy, Playwright seams. Own file — mock-api.ts is already past the 500-line guideline |
| `api/mock-pin.ts` | Mock account PIN (pin.yaml, USDX-651): `verifyMockPin` (shared `pin` lockout, 5 wrong / 15 min), `mockSetPin` / `mockChangePin`, `isMockPinSet` for the profile copy. State in localStorage (`usdx-mock-pin`); absent = the demo PIN `123456`, `{ pin: null }` = no PIN. The PIN belongs to the account, not the wallet — `seedMockPin(pin \| null)` (unit) / `seedAccountPin` (Playwright) |

To wire a new real endpoint: add a function to the relevant `*-api.ts` that branches on `env.useMock`, calling `apiFetch` for the real path and a `mock*` fn otherwise.

Wallet-custodial error helpers in `api/errors.ts` (USDX-567): `isWalletNotFound`,
`isWalletNotActive`, `isWalletServiceUnavailable`, `isInvalidPin`, `isPinNotSet`,
`isTooManyAttempts`, `isIdempotencyKeyInProgress`, `isIdempotencyKeyReused`,
`isRecipientBlacklisted`, `isTransferLimitExceeded` + `getTransferLimitDetails`. They
branch on `code` AND status because three 409s overlap (wallet.yaml § PETA KODE 409).
PIN set/change (USDX-651): `isReauthRequired` (401 — overwriting an existing PIN without a
fresh session, i.e. the profile copy was stale) and `isPinUnchanged` (422).

Mock custodial money paths (`api/mock-custodial-wallet.ts`, USDX-567 on top of the
566 state machine): the account PIN comes from `mock-pin.ts` (`123456` by default,
lockout after 5 wrong), transfer idempotency enforced like the contract (replay resolved
before the balance pre-check), seams `serviceDown`, `transferLimit`, `slowFirstTransfer`
(the PIN seam is `seedMockPin` / `seedAccountPin`). Redeem (in
`mock-api.ts`, via helpers imported from the custodial file): `burnMode` is derived from
`userAddress`, the custodial burn is dispatched 1.5 s after create (hash only; the
scanner owns the status), `burn-tx` on a CUSTODIAL order → 409. `MOCK_BLACKLISTED_ADDRESS`
is hosted in the custodial file and re-exported by `mock-api.ts`.

## Constants

- `EXCHANGE_RATE = 1` (1 USDX = 1 USD)
- `MAX_MINT_AMOUNT = 1,000,000` (the mint minimum is runtime config, not a constant)
- `MINTING_FEE_PERCENT = 0.007` (0.7%)

## Adding a New Chain

Add entry to `SUPPORTED_CHAINS` array in `chains.ts`:

```typescript
{ id: "newchain", name: "New Chain", shortName: "NC", icon: "/chains/nc.svg", contractAddress: "0x...", explorerUrl: "https://..." }
```

No other changes needed — `ChainSelector` and all hooks read from this array.
