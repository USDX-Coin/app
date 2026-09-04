# src/lib — Core Business Logic

Shared utilities, validation rules, constants, chain config, and mock API layer.

## Files

| File | Purpose |
|------|---------|
| `utils.ts` | `cn()`, `formatAmount()`, `formatUSD()`, `truncateAddress()`, `parseAmount()` |
| `validations.ts` | All form validators — return an i18n key or `null`; `translateValidation(t, key)` renders it |
| `constants.ts` | Exchange rate (1:1), min/max amounts, fee (0.7%), brand color |
| `chains.ts` | 8 supported chains with id, name, icon, contract address |
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
mint/redeem bounds) from `constants.ts`, so a limit is never copied into the dictionary.

Validators: `validateEmail`, `validatePassword`, `validateAmount`, `validateAddress`, `validateConfirmPassword`, `validateFullName`, `validatePhone`, `validateBankAccountNumber`, `validateBankAccountName`. `passwordScore` reports how many password rules are met, for `ui/password-strength.tsx`.

Amount validation accepts `"mint" | "redeem"` type parameter for different min/max bounds.

Address validation auto-detects EVM (starts with `0x`, 42 chars) vs Solana (base58, 32-44 chars).

## API Layer (USDX-150)

Auth + KYC now route through real-or-mock dispatchers; mint/redeem/transactions are still mock-only (Week 2+).

| File | Purpose |
|------|---------|
| `env.ts` | `NEXT_PUBLIC_API_BASE_URL` + `useMock` flag (mock when no base URL) |
| `api/client.ts` | `apiFetch` — Bearer auth, SoT envelope unwrap, `ApiError`, 401 → `onUnauthorized` |
| `api/errors.ts` | `ApiError` helpers (`isEmailNotVerified`, `getRateLimitSeconds`, …) |
| `api/auth-api.ts` | `login/register/verifyEmail/resend/forgot/reset/getMe` → `/api/v2/auth/*` or mock |
| `api/kyc-api.ts` | `getMyKycStatus/submitKyc/requestPresignedUpload` → `/api/v2/kyc`, `/api/v2/storage` or mock |
| `api/mock-api.ts` | In-memory mock backend used when `env.useMock` is true. Demo user: `demo@usdx.com` / `Demo1234` |

To wire a new real endpoint: add a function to the relevant `*-api.ts` that branches on `env.useMock`, calling `apiFetch` for the real path and a `mock*` fn otherwise.

## Constants

- `EXCHANGE_RATE = 1` (1 USDX = 1 USD)
- `MIN_MINT_AMOUNT = 10`, `MAX_MINT_AMOUNT = 1,000,000`
- `MINTING_FEE_PERCENT = 0.007` (0.7%)

## Adding a New Chain

Add entry to `SUPPORTED_CHAINS` array in `chains.ts`:

```typescript
{ id: "newchain", name: "New Chain", shortName: "NC", icon: "/chains/nc.svg", contractAddress: "0x...", explorerUrl: "https://..." }
```

No other changes needed — `ChainSelector` and all hooks read from this array.
