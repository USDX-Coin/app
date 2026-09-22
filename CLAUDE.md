# USDX Stablecoin App

USD-backed stablecoin web app with minting and redeeming. Modeled after [IDRX](https://app.idrx.co).

## Quick Start

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # Production build
pnpm lint         # ESLint
pnpm test         # Unit tests (Vitest)
pnpm test:integration  # Integration tests (Playwright, production build)
pnpm test:e2e     # E2E tests (Playwright, production build)
```

Demo credentials: `demo@usdx.com` / `Demo1234`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | TailwindCSS v4 + shadcn/ui (New York) |
| Client State | Zustand 5 (persist to localStorage) |
| Server State | TanStack Query 5 |
| Wallet | RainbowKit 2 + Wagmi 2 + Viem 2 |
| Unit Tests | Vitest 4 + Testing Library |
| E2E/Integration | Playwright 1.61 |
| Package Manager | pnpm |

## Design System

Brand: maroon `#800000` → `#ac0004` dengan aksen gold `#f7a100`. (Nilai `#1eaed5`
di dokumen ini sebelumnya sudah lama tidak dipakai.)

Token di `src/app/globals.css` dipisah dua kelompok, dan pembagiannya penting:

- **Warna permukaan** (`--primary`, `--destructive`, `--success`, `--warning`) —
  untuk fill: tombol, pill, ikon, tint. Rasio kontrasnya memang tidak perlu 4,5:1.
- **Warna teks** (`--primary-text`, `--destructive-text`, `--success-text`,
  `--warning-text`, `--muted-text`, `--info-text`, `--focus-ring`, `--on-gold`) —
  untuk apa pun yang dibaca. Semuanya lolos WCAG AA di kedua tema.

Memakai warna permukaan untuk teks adalah bug: `--primary` hanya 1,59:1 di atas
kartu gelap. Pola pemisahan ini sama dengan `--primary` vs `--primary-foreground`
milik shadcn.

**Motion**: durasi bernama `--dur-1..5` (90/150/220/320/600 ms) dan easing
`--ease-standard|enter|exit`. Tailwind v4 tidak punya namespace `--duration-*`,
jadi dipakai lewat `duration-(--dur-3)`. Preset spring untuk Animate UI ada di
`src/lib/motion.ts` — jangan tulis angka spring di komponen. Aturannya: keluar
selalu lebih cepat daripada masuk.

**Logo**: pakai `/image/usdx-coin.svg` (vektor, 2,3 kB). `usdx-logo.png` hanya
tersisa sebagai cadangan favicon. **`Logo.svg` adalah logo LAMA — jangan dipakai.**

Spesifikasi lengkap ada di file Figma `USDX (Copy)` → page `DS · Standar 2026-09`,
dan catatan auditnya di `catatan/audit-ui-2026-09-03/`.

## Architecture

```
src/
  app/              # Next.js pages (App Router, Server Components)
    (auth)/         # Login, register, forgot-password (Server Components)
    (dashboard)/    # Mint, redeem, transactions, profile (SC pages + Client wrappers)
  components/
    auth/           # LoginForm, RegisterForm, ForgotPasswordForm (Client)
    shared/         # Cross-feature: PageHeader, PinConfirmDialog + PinField + PinSetupDialog/PinChangeDialog/PinNotSetNotice/ForgotPinLink (PIN, USDX-567/651/696)
    layout/         # AuthLayout, Header, Sidebar, Logo
    mint/           # MintForm, MintReview, MintPageContent, skeletons
    redeem/         # RedeemForm, RedeemReview, RedeemPageContent, skeletons
    wallet/         # Custodial wallet (USDX-566): offer, status panel, receive address + QR, sidebar card, onboarding step
    settings/       # SettingsPageContent (Pengaturan — home of the custodial wallet) + PinSection (transaction PIN, USDX-651)
    transfer/       # Custodial transfer: TransferForm, TransferReview, TransferResult (tracker), TransferPageContent (USDX-567); TransferStatusPanel/Badge, TransferHistoryList, TransferDetail, TransferHistoryLink (USDX-701)
    transactions/   # TransactionList, skeletons
    profile/        # ProfileCard, skeleton
    ui/             # shadcn/ui base components (auto-generated)
  hooks/            # Custom hooks (useAuth, useMint, useRedeem, useCustodialWallet, useTransfer, usePin, etc.)
  stores/           # Zustand stores (authStore, mintStore, redeemStore, transferStore)
  lib/              # Utilities, validations, constants, chains (7 EVM), mock API
  providers/
    Providers.tsx       # QueryClient + Toaster (lightweight, all pages)
    WalletProviders.tsx # RainbowKit + Wagmi (dashboard only)
  types/            # Shared TypeScript interfaces
tests/
  helpers/          # Shared test utilities (test-utils.tsx, playwright-utils.ts)
  unit/             # Vitest — business logic, hooks, stores, API
  integration/      # Playwright — page interactions + responsive viewports
  e2e/              # Playwright — full user flows
```

## State Flow

```
Zustand Store  →  Custom Hook  →  Component  →  Mock API
(client state)    (logic+calc)    (UI render)   (async ops)
```

- **Zustand**: form wizard state (step, chainId, amount), auth (user, token)
- **TanStack Query**: async data (transactions, wallet balance, mutations)
- **Hooks**: combine store + query + validation + calculations + useMemo

## Key Patterns

### Server Components
Pages are Server Components that render Client Component wrappers:
- Auth pages: `page.tsx` (SC) → `LoginForm` (CC)
- Dashboard pages: `page.tsx` (SC) → `MintPageContent` (CC)
- Dashboard layout stays `"use client"` (auth guard + mobile menu)

### Provider Architecture
- Root `Providers.tsx`: QueryClient + Toaster (all pages)
- `WalletProviders.tsx`: RainbowKit + Wagmi (dashboard layout only)
- Auth pages don't load wallet JavaScript (~250KB savings)

### Dashboard Shell Layout
`(dashboard)/layout.tsx` owns the **single** scroll area — the rounded card. The
page padding lives on an inner `flex min-h-full flex-col px-5 pt-5 pb-8 …`
wrapper, never on the scroller itself, so long pages keep their bottom padding
and short pages don't get a phantom scrollbar. Rules for page roots:
- Grow with content — use `flex-1`, never `h-full` (a fixed-height page box
  unsticks the header and swallows the bottom padding)
- Self-centering roots (`mx-auto max-w-*`) also need `w-full`: they are flex
  items, and auto cross-margins cancel the default stretch
- The page heading is the **first** element in the root and carries
  `PAGE_HEADING_STICKY` (`components/shared/PageHeader.tsx`) so it stays pinned
  while the body scrolls under it. `PageHeader` already includes it
- Rows that center a card horizontally need `items-start`, otherwise the default
  `stretch` pulls the card down to the bottom of the page

### Error Boundaries
Per-route `error.tsx` files in each dashboard route. Uses Next.js App Router convention with `reset()` callback.

### Skeleton Loading
Detailed skeleton components matching exact layout per feature. Used with conditional `isLoading` checks (not Suspense — `useQuery` doesn't suspend).

### Validation
All validators return `string | null` — **an i18n key**, or null when the value is
valid. The component turns the key into a sentence with `translateValidation(t, key)`
(`src/lib/validations.ts`), which also fills in the bounds from `constants.ts`. They
used to return English sentences, which is how "Email is required" ended up under an
Indonesian label. EVM-only address validation (must start with `0x`). Hoisted regex at
module level.

### Multi-Step Forms
Mint and Redeem keep their state in Zustand stores; the Ringkasan is a modal:
- Mint: single form view → Ringkasan modal → cross-origin checkout handoff (USDX-201/225).
  A custodial-wallet owner gets a destination switch (`mintStore.destinationSource`):
  "wallet custodial saya" (default — the profile address fills `userAddress`, no new
  API field, `custodial-wallet.md` §5.2) or "alamat lain" (the unchanged manual path)
- Redeem: `form` → `tracker`; Ringkasan modal over the form → create order → **konfirmasi
  tujuan** → contextual wallet burn (simulated in W3) → status tracker polling (USDX-243).
  The burn never fires from the create (USDX-661, `bni-integration.md § 17.12`): the tracker
  states the destination the ORDER answered with — bank · nomor rekening · `bankAccountName`
  — and the burn button stays disabled until the customer ticks the agreement. Same gate on
  the resume-from-`/history` path; the CUSTODIAL path has no gate (the PIN was the approval).
  The Ringkasan button therefore says "Lanjut ke Konfirmasi", not "Konfirmasi & Burn" — it
  only creates the order.
  Whether that holder name may be called **the bank's answer** is decided by
  `bankAccountNameVerified` in the order response (USDX-672, `api/redeem.yaml`), never
  assumed: the backend falls back to the name the customer typed when the provider answers
  no name, so `false` — and a payload that does not carry the field at all — show the name
  with no provenance claim. The agreement is required either way.
  A custodial-wallet owner also picks the burn source (`redeemStore.source`): custodial
  (PIN in the create body, the backend returns `burnMode: CUSTODIAL`, the system burns,
  the tracker shows "memproses burn" and never asks for a signature or reports a burn-tx)
  or external (the unchanged self-sign path). `burnMode` is decided by the backend, never
  sent by the FE (`redeem.yaml`, USDX-565/567)
- Transfer (custodial only, `/send`): `form` → Ringkasan modal → `PinConfirmDialog` →
  `POST /api/v2/wallet/transfer` → `done` = confirmation tracker (USDX-701). 202 is proof
  of BROADCAST, not settlement: the tracker starts at "Terkirim, menunggu konfirmasi" +
  explorer link and polls `GET /api/v2/wallet/transfers/{id}` (`TransferAccepted.id`)
  every 3 s via `hooks/useWalletTransferTracker` until CONFIRMED ("Berhasil") or FAILED
  ("Gagal — USDX tidak berpindah, aman kirim ulang"); it stops at a final status and on
  unmount, backs off to `Retry-After` on 429, and NEVER infers failure from age. Unknown
  `status` values read as PENDING (`lib/wallet-transfer.ts`). History: `/send/history`
  (list, page/take, API order) + `/send/history/[id]` (same tracker; 404/422 = neutral
  "not found" + back). `Idempotency-Key` (UUID v7) is minted once per
  intent by `transferStore` and reused by every retry; `setTo`/`setAmount` drop it

Step state lives in Zustand stores. Form data preserved when going back.

**Coming back from the mint handoff**: `/mint` leaves the origin entirely, so the
Back button hands the user a page restored from the browser's back-forward cache —
modal open, form filled, buttons live — for an order that may already be paid.
`hooks/useMintHandoffReset` (mounted by `MintPageContent`) wipes that state on
`pageshow`/`persisted` when `mintStore.handoffPending` is set, and the same flag
keeps the confirm button disabled for the whole cross-origin navigation. Untouched
input (tab switch, Back from anywhere else) is deliberately left alone. Redeem never
leaves the origin, so it needs none of this.

### Mock API
All backend calls go through `src/lib/api/mock-api.ts` with simulated delays. Replace with real API client when backend is ready.

### Shared Components
- `ChainSelector` — `components/shared/` (React.memo-wrapped, used by Mint and Redeem)
- `validations.ts` — shared across all forms
- `chains.ts` — 7 EVM chains, Map-based O(1) lookups

### Re-render Optimization
- `React.memo` on ChainSelector
- `useMemo` for selectedChain in hooks, initials in Header
- Query invalidation after mint/redeem mutations
- Redeem status tracker polling stops at terminal states (PAYOUT_COMPLETE / EXPIRED)

## Responsive Design

Breakpoint strategy (mobile-first):
- Default (< 768px): Single column, hamburger menu, card views
- `md` (768px+): Sidebar visible, table views, more padding
- `lg` (1024px+): Side-by-side form + review panels

## Testing

```
describe('functionOrPage') →
  describe('positive') → test('...')
  describe('negative') → test('...')
  describe('edge cases') → test('...')
```

- **Unit tests**: hooks, stores, API, validations, utils, chains
- **Integration tests**: page interactions + responsive (mobile/tablet/desktop)
- **E2E tests**: auth flow, mint flow, redeem flows, address book, QR scan, rate limit, custodial transfer/redeem (tracker to CONFIRMED/FAILED + history, USDX-701), PIN created from the money paths

Test helpers in `tests/helpers/`:
- `test-utils.tsx`: QueryClient wrapper for renderHook (`createWrapper`, gcTime 0; `createCachingWrapper` keeps the cache across unmounts like the app)
- `playwright-utils.ts`: loginViaStorage, clearAuth, VIEWPORTS

## Route Structure

| Route | Auth | Type | Description |
|-------|------|------|-------------|
| `/login` | No | SC | Email/password login |
| `/register` | No | SC | Create account |
| `/forgot-password` | No | SC | Password reset |
| `/mint` | Yes | SC | Mint USDX (default dashboard) |
| `/redeem` | Yes | SC | Redeem USDX to bank |
| `/history` | Yes | SC | Transaction history (mint + redeem, W3). Custodial transfers are NOT here (own resource) — wallet owners get a link to `/send/history` |
| `/profile` | Yes | SC | User info + verification badge |
| `/settings` | Yes | SC | Pengaturan: custodial "USDX wallet" (offer — the "Buatkan saya wallet" button on builds with `env.walletCreateEnabled` ON = dev + mock, the "Segera hadir" pill everywhere else incl. production, USDX-699 / address + QR + balance / status) + Account card with the transaction PIN (create / change, USDX-651) + link to Profile (USDX-566; switch: `custodial-wallet.md` §1 amandemen 14 Sep + 21 Sep 2026) |
| `/onboarding/wallet` | Yes | SC | "Dikasih wallet" step (USDX-566). **No longer reached from verify-email** — that redirect is off in every environment (verify-email lands on `/mint`, `custodial-wallet.md` §1 amandemen 14 Sep 2026); only a direct URL opens it. Same offer as Settings (button or pill by `env.walletCreateEnabled`, USDX-699). "Not now" → `/mint` |
| `/bridge` | Yes | SC | ComingSoon (gated — no bridge backend yet; sidebar teaser) |
| `/send` | Yes | SC | Custodial transfer (`TransferPageContent`) for users with `user.custodialWallet`; ComingSoon for everyone else (no external-wallet send backend) |
| `/send/history` | Yes | SC | Custodial transfer history (`TransferHistoryList`, USDX-701) — `GET /api/v2/wallet/transfers`, linked from `/send` and `/history` for wallet owners (`TransferHistoryLink`); empty list for users without a wallet |
| `/send/history/[id]` | Yes | SC | One transfer + confirmation tracker (`TransferDetail`, USDX-701); stale/wrong id → neutral "not found" + back to history |

## Known Limitations

- Auth, KYC, mint, redeem, and history all hit the **real backend** (`/api/v2/*`).
  `mock-api.ts` is only used when `NEXT_PUBLIC_API_BASE_URL` is unset or
  `NEXT_PUBLIC_USE_MOCK=true` forces it (local demo mode, see `src/lib/env.ts`)
- Mint and redeem are gated by a backend **503** until the payment-provider env is
  configured on the target environment
- The redeem **burn is real on-chain**; whether the IDR payout (disbursement) is
  simulated is answered by the **backend**, via `redeemPayoutSimulated` in
  `GET /api/v2/config` (USDX-683) — the tracker posts the "Mode simulasi" notice on
  `true` only. `false`, and the whole window before the backend ships the field,
  show nothing: an unknown value must not claim the payout is fake. The old
  build-time client flag that used to decide this is gone. `env.useMock`
  remains a separate trigger for the same sentence (client mock layer, not the
  backend adapter)
- Bridge is **ComingSoon-gated**, and so is Send **for users without a custodial
  wallet**: their old UIs faked success locally (`bridge_/send_<timestamp>`, no API
  call), so those routes render `ComingSoon`. The sidebar **keeps both items visible**
  as promotion teasers (PM, 13 Aug) — icon + a `nav.soon` pill ("Coming Soon" /
  "Segera Hadir"). For a **custodial-wallet owner** `/send` is the real transfer form
  (USDX-567) and the Send pill comes off (`Sidebar.navItemsFor`). `components/bridge/`
  and the old `components/send/` are gone; the transfer lives in `components/transfer/`
- **Custodial money paths (USDX-567)** — transfer (`/send`), mint destination
  "wallet custodial saya", redeem source custodial. All three read the wallet through
  `useCustodialWallet` (566) — `isActive`, `address`, `balanceState`, `pinSet`. The PIN
  is the backend's existing mechanism (`pin.yaml`). **Create / change PIN (USDX-651)**:
  `PinSetupDialog` (`POST /auth/pin/set`) and `PinChangeDialog` (`POST /auth/pin/change`)
  via `hooks/usePin`, at home in Settings → Account (`PinSection`); `PIN_NOT_SET` /
  `user.pinSet === false` shows the `PinNotSetNotice` ("buat PIN dulu" + a Create PIN
  button that opens the set dialog in place) and disables the step. `user.pinSet` in the
  auth store is the single source the money screens read: `/set` success flips it to
  `true` at once (no /auth/me wait), `401 PIN_NOT_SET` flips it to `false`, `401
  REAUTH_REQUIRED` follows `details.pinSet` (absent = true; `false` = log in again, then
  create the PIN — `hooks/useRelogin` + `lib/auth/relogin-intent` bring the user back to
  the Create PIN dialog on Settings, USDX-697). **Forgot PIN (USDX-696)**: a "Forgot PIN?"
  link (`ForgotPinLink`) in `PinConfirmDialog` and `PinChangeDialog`, also while locked out
  → Log in again with the `forgot-pin` intent → Settings opens `PinSetupDialog
  variant="reset"` ("Create a new PIN", `/set {pin}` without `currentPin` on the fresh
  session, even though the account has a PIN); there `REAUTH_REQUIRED` = the 5-minute
  window passed → log in again (`mapPinError(err, "reset")`, never "use Change PIN") — every
  correction goes through `hooks/usePinSetCorrection`, which writes the store AND the
  `["session","me"]` cache so a stale cached /auth/me cannot write the old value back. Mock: `seedMockCustodialWallet` (unit, `mock-custodial-wallet.ts`) /
  `seedCustodialWallet(page, { status, balance, …seams })` (Playwright); the account PIN
  is its own seam — `mock-pin.ts`, `seedMockPin(pin | null)` (unit) /
  `seedAccountPin(page, pin | null)` (Playwright), default PIN `123456`; the backend of
  USDX-698 (first-time PIN on a wallet account needs a fresh login) is ON by default
  (698 is live on api-dev; `seedMockStrictPinSet(false)` = the old backend) — a flow that
  starts right after a login arms `seedFreshPasswordAuth(page)` (Playwright)
- **Custodial transfer history (USDX-701)** — mock ledger in localStorage
  (`usdx-mock-wallet-transfers`, `lib/api/mock-wallet-transfers.ts`): every mock
  transfer lands as PENDING and the "receipt watcher" decides it 3.5 s later (seam
  `transferOutcome` on `seedCustodialWallet`: `CONFIRMED` default, `REVERTED`, `DROPPED`,
  `PENDING` = stuck forever, anything else = a status the FE does not know). Fixtures for
  the three statuses + two failure reasons: `lib/api/mock-wallet-transfer-fixtures.ts`
  (types only, so Playwright imports it) — `seedMockWalletTransfers` (unit) /
  `seedWalletTransfers(page, rows)` (Playwright)
- The `/payment` mock gateway route was deleted (it faked "Payment Successful" with a
  `setTimeout`); the real mint flow uses the cross-origin checkout handoff
- RainbowKit wallet connection works; the USDX balance is read **on-chain for real**
  (`balanceOf` on Polygon) via `hooks/useWalletBalance` in the sidebar. Wallets are
  never auto-reconnected, so an unconnected/loading/failed read is
  shown as "—" plus a reason, never as a number (USDX-396)
- **Custodial wallet** (USDX-566, `wallet.yaml`): `POST/GET /api/v2/wallet` via
  `lib/api/wallet-api.ts` + `hooks/useCustodialWallet`. Routing comes from
  `user.custodialWallet` on `/auth/me` (never "GET then swallow 404"); the poll
  while PROVISIONING is capped (60 s) and the retry is a repeat `POST` — the
  only thing that refreshes the backend's working copy (`custodial-wallet.md`
  §5.5); `balance: null` renders as "—", never 0. Transfer / mint-to-custodial /
  redeem-from-custodial UI is USDX-567 (next bullet). In mock mode the wallet lives in
  localStorage (`usdx-mock-custodial`) and flips to ACTIVE 1.5 s after create
- WalletConnect SSR produces `indexedDB` warnings (harmless)
- Solana removed — EVM chains only (7 chains)
- Validation messages are translated in both locales (`validation.*` keys in
  `lib/i18n/dictionaries.ts`); `validations.ts` returns the key and the component
  translates it


# Source of Truth

Folder `sot/` contains the project spec. Read before coding. Never edit `sot/`.

**If spec is unclear — ask the PM, don't assume.**

## Key files for this repo:

- `sot/phase-2/week1.md` — **AKTIF (Week 1)**: auth flow (register/verify/login/forgot password), KYC INDIVIDUAL flow, FE deliverables, error codes per endpoint
- `sot/phase-2/phase2.md` — Phase 2 overview: pages roadmap, mint/redeem/bridge flows (W2+)
- `sot/conventions.md` — API response format, naming conventions, status enums
- `sot/api/openapi.yaml` — API contract entry point (consumer endpoints `/api/v2/*`: `auth.yaml`, `kyc.yaml`, `storage.yaml`)

## Critical rules:

- **App SUDAH ADA — jangan scaffold ulang.** Next.js App Router + Tailwind v4 + shadcn/ui, UI mock sudah sesuai Figma. Scope Week 1 = ganti mock dengan real API + tambah halaman yang belum ada (lihat `sot/phase-2/week1.md` § Deliverables Week 1)
- Ganti `src/lib/api/mock-api.ts` **bertahap** dengan real API client (`NEXT_PUBLIC_API_BASE_URL` → `/api/v2/*`) — jangan rewrite sekaligus
- API responses follow `{ status, metadata, data, error }` format — see `sot/conventions.md`
- Auth: Better Auth client **consumer audience** (session 30 hari sliding) — bukan audience backoffice
- Error handling konsisten: 401 → clear session + redirect `/login`; 403 `EMAIL_NOT_VERIFIED` → banner verifikasi + tombol resend; 403 `KYC_NOT_VERIFIED` → lock CTA + arahkan ke `/kyc`; 429 → cooldown countdown
- KYC upload via presigned URL: `POST /v2/storage/presigned-upload` → PUT file langsung ke bucket → `POST /v2/kyc` dengan objectKeys (lihat `sot/phase-2/week1.md` § Consumer App Flow)
- KYC status enums: `UNVERIFIED | PENDING | VERIFIED | REJECTED` — CTA mint/redeem terkunci kalau bukan `VERIFIED` (bridge/send digate ComingSoon, belum punya CTA)
- SOT is authoritative — if your implementation differs from SOT, your code adjusts (not SOT)

## PR Description

Saat buat PR, generate description mengikuti format di `sot/templates/pr-template.md`. Ini wajib — PM review berdasarkan structure ini.

Key points:
- Selalu include "PM Action Items" section (bisa "None")
- Selalu include "SoT Alignment" table — cross-check setiap field/endpoint vs SOT
- Jika implement sesuatu yang TIDAK ada di SOT → masukkan ke "Known Drift > Needs PM Action" dengan category ❓ Decision
- Jika ada AC yang belum bisa dicapai → mark ⏳ Deferred dengan reason
- Jika ada action yang harus dilakukan SETELAH merge → masukkan "Post-Merge Actions"
