# src/lib — Core Business Logic

Shared utilities, validation rules, constants, chain config, and mock API layer.

## Files

| File | Purpose |
|------|---------|
| `utils.ts` | `cn()`, `formatAmount()`, `formatUSD()`, `truncateAddress()`, `parseAmount()` |
| `validations.ts` | All form validators — return `string \| null` |
| `constants.ts` | Exchange rate (1:1), min/max amounts, fee (0.7%), brand color |
| `chains.ts` | 8 supported chains with id, name, icon, contract address |
| `api/mock-api.ts` | Mock backend — login, register, transactions, mint/redeem orders |
| `api/types.ts` | Request DTOs: `LoginRequest`, `RegisterRequest`, `CreateMintRequest`, `CreateRedeemRequest` |

## Validation Pattern

Every validator follows this contract:

```typescript
function validateX(input: string): string | null
// null = valid, string = error message
```

Validators: `validateEmail`, `validatePassword`, `validateAmount`, `validateAddress`, `validateConfirmPassword`, `validateFullName`

Amount validation accepts `"mint" | "redeem"` type parameter for different min/max bounds.

Address validation auto-detects EVM (starts with `0x`, 42 chars) vs Solana (base58, 32-44 chars).

## Mock API

All functions are async with simulated delay (200-1200ms). Demo user: `demo@usdx.com` / `Demo1234`.

To replace with real API: swap function bodies in `mock-api.ts`, keep the same signatures. Types in `api/types.ts` define the contract.

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
