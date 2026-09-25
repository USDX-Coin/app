// Consumer user — mirrors openapi `User` (users.yaml) returned by GET /api/v2/auth/me.
export type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type EntityType = "INDIVIDUAL" | "LEGAL_ENTITY";

export interface User {
  id: string;
  // Null until KYC submit (self-signup users don't provide a name at register).
  name: string | null;
  email: string;
  phone: string | null;
  entityType: EntityType;
  kycStatus: KycStatus;
  suspended: boolean;
  // Null = email not yet verified.
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Akun sudah punya PIN 6-digit (`users.pin_hash` terisi — users.yaml § User
  // `pinSet`, pola pin.yaml). Transfer & redeem custodial memakai PIN itu; `false`
  // → arahkan user membuat PIN dulu, jangan buka dialog PIN yang pasti gagal.
  // Opsional: sesi yang di-persist sebelum field ini ada tidak membawanya.
  pinSet?: boolean;
  // Wallet custodial user (users.yaml § User → `custodialWallet`, USDX-607/566).
  // `null` = user tidak punya (mayoritas non-custodial). Ini yang menentukan
  // routing: tawarkan "dikasih wallet" atau tampilkan saldo — TANPA memanggil
  // `GET /api/v2/wallet` lalu menelan 404 di setiap cold start.
  //
  // Opsional karena `user` di-persist ke localStorage: sesi yang disimpan sebelum
  // field ini ada tidak membawanya sama sekali. `undefined` dibaca seperti `null`
  // (tidak ada penawaran yang salah), dan refresh `/auth/me` (useSession) yang
  // mengisinya.
  custodialWallet?: CustodialWalletSummary | null;
}

// ── Wallet custodial (wallet.yaml, Gelombang 1 USDX-551 · FE USDX-566) ────────
// Kunci dipegang sistem (wallet-service → Web3Signer → Vault); yang dibaca app
// hanya salinan kerja backend. Status = `common.yaml § CustodialWalletStatus`.
// TIDAK ada nilai gagal: provisioning yang gagal tetap PROVISIONING dan di-retry
// wallet-service — karena itu FE membatasi poll + menyediakan "coba lagi"
// (`custodial-wallet.md` §5.5).
export type CustodialWalletStatus = "PROVISIONING" | "ACTIVE" | "SUSPENDED";

// Bentuk ringkas yang menempel di profil (`User.custodialWallet`). Sengaja tanpa
// saldo: profil tidak boleh menahan responsnya menunggu pembacaan RPC.
export interface CustodialWalletSummary {
  // Null selama PROVISIONING — address baru ada setelah kunci masuk Vault dan
  // terverifikasi di `eth_accounts`.
  address: string | null;
  status: CustodialWalletStatus;
}

// GET/POST /api/v2/wallet (wallet.yaml § CustodialWallet). Satu tipe untuk
// keduanya; field yang belum berlaku bernilai null.
export interface CustodialWallet extends CustodialWalletSummary {
  chain: string; // "polygon" — gelombang 1 Polygon-only
  contractAddress: string; // kontrak USDX proxy di chain ini — asal angka `balance`
  // Saldo USDX desimal, dibaca LIVE dari chain. **Null = tidak terbaca** (RPC tak
  // terjangkau / masih PROVISIONING), BUKAN nol — UI merender "—", jangan 0:
  // saldo nol palsu terbaca user sebagai dana hilang.
  balance: string | null;
  balanceWei: string | null; // uint256 string; null bersama `balance`
  balanceAt: string | null; // waktu pembacaan; null bersama `balance`
  createdAt: string; // permintaan diterima, bukan waktu ACTIVE
}

// POST /api/v2/wallet/transfer → 202 (wallet.yaml § TransferAccepted). **Bukti
// BROADCAST, bukan bukti settle**: tx sudah di mempool, konfirmasi on-chain terjadi
// setelahnya dan dipantau lewat `GET /api/v2/wallet/transfers/{id}` memakai `id`
// (amandemen 22 Sep 2026, USDX-701). UI tidak boleh mengklaim "berhasil" di sini.
export interface TransferAccepted {
  // Kunci tracker `GET /api/v2/wallet/transfers/{id}`. Replay (200) dengan key yang
  // sama mengembalikan id yang SAMA — satu niat transfer = satu tracker.
  id: string;
  txHash: string; // 0x-prefixed, 66 chars
  from: string; // address custodial pengirim (echo)
  to: string;
  amount: string; // decimal USDX
  amountWei: string; // uint256 string
  chain: string;
  // Waktu broadcast. Pada replay idempotency ini tetap waktu broadcast ASLI.
  submittedAt: string;
}

// Status on-chain transfer yang sudah di-broadcast (wallet.yaml § WalletTransferStatus,
// USDX-701). Diputuskan watcher receipt backend. Enum boleh bertambah — FE WAJIB punya
// cabang default: nilai tak dikenal diperlakukan PENDING (`lib/wallet-transfer.ts`).
export type WalletTransferStatus = "PENDING" | "CONFIRMED" | "FAILED";
// Sebab FAILED (hanya terisi saat FAILED). Keduanya = USDX tidak berpindah, aman
// mengirim ulang sebagai niat baru. Enum bisa bertambah.
export type WalletTransferFailureReason = "REVERTED" | "DROPPED";

// Satu transfer keluar dari wallet custodial (wallet.yaml § WalletTransfer) — item
// `GET /api/v2/wallet/transfers` dan isi `GET /api/v2/wallet/transfers/{id}`. Field
// identitas sama persis dengan `TransferAccepted`. `status` / `failureReason` diketik
// `string` dengan sengaja: nilai di luar enum bisa datang dari backend yang lebih
// baru, dan hanya `lib/wallet-transfer.ts` yang boleh menafsirkannya.
export interface WalletTransfer {
  id: string;
  txHash: string;
  from: string;
  to: string;
  amount: string; // decimal USDX, selalu 6 desimal
  amountWei: string;
  chain: string;
  status: WalletTransferStatus | (string & {});
  failureReason: WalletTransferFailureReason | (string & {}) | null;
  blockNumber: number | null; // null sebelum ada receipt, dan untuk DROPPED
  submittedAt: string;
  finalizedAt: string | null; // null selama PENDING
}

// Siapa yang menandatangani burn sebuah redeem order (common.yaml § BurnMode).
// Ditentukan BACKEND saat create dari salinan kerja wallet custodial — FE tidak
// mengirimkannya. CUSTODIAL → FE tidak menampilkan layar tanda tangan wallet dan
// tidak memanggil `POST /redeem/{id}/burn-tx` (→ 409 INVALID_ORDER_STATE).
export type BurnMode = "SELF_SIGN" | "CUSTODIAL";

// Own KYC status (consumer) — openapi KycMyStatus (kyc.yaml). No PII payload.
// Fields besides `status` are absent when the user has never submitted KYC —
// the backend falls back to users.kyc_status only (kyc.yaml § myStatus, USDX-147).
export interface KycMyStatus {
  status: KycStatus;
  submissionCount?: number | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  // USDX-545 — is the CDD block on record for this customer?
  //
  // AWAITING BACKEND: `/api/v2/kyc/me` does not return this yet. It is the ONLY
  // thing that tells an already-VERIFIED customer apart from one who still owes
  // us due-diligence answers, and it is deliberately a boolean rather than the
  // values themselves — /kyc/me carries no PII by contract (kyc.yaml § myStatus)
  // and this must not become the exception.
  //
  // `undefined` means "the backend has not shipped it", NOT "complete" and NOT
  // "missing" — see lib/kyc/form-mode.ts for why unknown shows no form.
  cddComplete?: boolean;
}

export interface Chain {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  contractAddress: string;
  explorerUrl: string;
}

export interface MintFormData {
  chainId: string;
  amount: string;
  destinationAddress: string;
}

export interface RedeemFormData {
  chainId: string;
  amount: string;
  bankAccountId: string;
}

export interface MintOrder {
  id: string;
  chainId: string;
  amount: number;
  destinationAddress: string;
  totalPaymentUsd: number;
  fee: number;
  status: TransactionStatus;
  createdAt: string;
}

export interface RedeemOrder {
  id: string;
  chainId: string;
  amount: number;
  bankAccountId: string;
  totalReceiveUsd: number;
  fee: number;
  status: TransactionStatus;
  txHash: string;
  createdAt: string;
}

export type TransactionStatus = "pending" | "completed" | "failed";
export type TransactionType = "mint" | "redeem" | "bridge" | "send";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  chainId: string;
  status: TransactionStatus;
  txHash: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

// Normalized session result used app-side. `token` is the Bearer credential
// (openapi AuthTokenV2.accessToken, falling back to sessionId for cookie audiences).
export interface AuthResponse {
  user: User;
  token: string;
}

// Result of POST /api/v2/auth/register — no session issued (user must verify email first).
export interface RegisterResult {
  email: string;
}

export type MintStep = "form" | "confirmation" | "status";
// Redeem is a single form view + a polling status tracker (USDX-243). The
// Ringkasan is a modal over the form (like mint), so there's no in-page
// confirmation step — `form` collects input, `tracker` polls the order status.
export type RedeemStep = "form" | "tracker";

// Burn guard state machine (USDX-259, week3.md § Guard double-burn):
//   idle       no burn in flight — the Burn CTA is actionable
//   submitting signing + broadcasting (and reporting) — CTA disabled
//   submitted  broadcast/reported optimistically — waiting for the scanner;
//              CTA stays disabled ("memproses burn") until status leaves AWAITING_BURN
//   error      tx rejected/failed — CTA re-enabled for retry (order still AWAITING_BURN)
export type RedeemBurnState = "idle" | "submitting" | "submitted" | "error";

// ── Phase 2 Week 2 — consumer mint / rate / address book / history (USDX-205) ──
// Mirrors the OpenAPI contract (rate.yaml, address-book.yaml, mint.yaml,
// transactions.yaml). Monetary values are decimal *strings* — the backend is
// authoritative; the FE never re-floats them. Status enums are the uppercase
// SoT values (conventions.md § Status Enums), distinct from the legacy lowercase
// `TransactionStatus`/`TransactionType` used by the W1-era mocked pages.

export type AmountCurrency = "USD" | "IDR";
export type PaymentChannel = "VA" | "QRIS";
export type VaBank =
  | "BCA"
  | "BNI"
  | "BRI"
  | "CIMB"
  | "DANAMON"
  | "INA"
  | "MANDIRI"
  | "PERMATA"
  | "MAYBANK";

// 3 separate status dimensions of a mint order.
// `HELD` (BNI, USDX-341) is in both enums in `sot/api/common.yaml` but was
// missing here, so TypeScript believed a held order could not exist — and the
// status label lookup in Riwayat returned `undefined`, rendering an empty pill
// for the one status that actually needs someone to act on it.
export type MintPaymentStatus =
  | "REQUESTED"
  | "WAITING_FOR_PAYMENT"
  | "PAID"
  | "EXPIRED"
  | "HELD";
export type MintSafeStatus = "NONE" | "PENDING_APPROVAL" | "APPROVED" | "EXECUTED" | "REJECTED";
export type MintOrderStatus =
  | "WAITING_FOR_PAYMENT"
  | "WAITING_FOR_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "HELD";

// Consumer order type (openapi TransactionType). W2 = MINT; REDEEM effective W3.
export type ConsumerOrderType = "MINT" | "REDEEM";

// GET /api/v2/rate — base + directional spread for the consumer preview.
// Mint previews with `effectiveBuyRate`, redeem (W3) with `effectiveSellRate`
// (rate.yaml § ConsumerRate). The final transaction value is re-snapshotted by
// the backend at order create — the FE never re-floats these.
export interface ConsumerRate {
  baseRate: string;
  spreadBuyPct: string;
  spreadSellPct: string;
  effectiveBuyRate: string; // baseRate × (1 + spreadBuyPct/100); mint preview
  effectiveSellRate: string; // baseRate × (1 − spreadSellPct/100); redeem preview
  updatedAt: string;
}

// GET /api/v2/config — the app's single source of runtime configuration
// (app-config.yaml, USDX-635; `mintMode` added by USDX-636). Needs a consumer
// session (401 without one). Everything here used to be a build-time constant or
// a copy of the backend's `fee_configs`, which is how the mint minimum ended up
// denominated in USDX and the contract address ended up baked into a bundle.
//
// All money fields are decimal STRINGS, same convention as ConsumerRate — the FE
// converts once, at the edge, and never re-floats them afterwards.
export interface AppConfig {
  /** Minimum mint value in IDR, compared against the order subtotal (not the total pay). */
  minMintIdr: string;
  /**
   * Minimum redeem value in IDR (`fee_configs.min_redeem_idr`), compared against
   * the NET payout — the rupiah the customer really receives after fees, not the
   * gross (app-config.yaml § AppConfig.minRedeemIdr, USDX-682).
   *
   * OPTIONAL, and it has to be: the backend field ships AFTER this app does
   * (merge order sot -> backend -> app), so for the whole rollout window the
   * response will not carry it. Absent means "the app asserts no minimum of its
   * own" — never a guessed number. See `useAppConfig` / `useRedeem`.
   */
  minRedeemIdr?: string;
  /**
   * Whether the IDR payout of a redeem is still SIMULATED in this environment
   * (`DISBURSEMENT_PROVIDER_KIND=MOCK`), or really sent through a provider
   * (app-config.yaml § AppConfig.redeemPayoutSimulated, USDX-683). Only the
   * backend knows which adapter is live: the app used to infer it from a
   * build-time flag that defaulted to ON, which is how the redeem tracker kept
   * captioning "payout simulated" after the real DurianPay payout shipped — a
   * lie on the very screen used to prove the payout was real.
   *
   * OPTIONAL, and it has to be: the backend field ships AFTER this app does
   * (merge order sot -> backend -> app). Absent means UNKNOWN, and unknown
   * shows NO notice — silence claims nothing, the banner claims something false.
   */
  redeemPayoutSimulated?: boolean;
  /** Mint fee, PERCENT of the subtotal (fee.yaml `mintFeePct`, e.g. "1.0" = 1%). */
  mintFeePct: string;
  /** Payment-gateway VA fee, flat IDR (fee.yaml `pgFeeVaFlat`, e.g. "4000.00"). */
  pgFeeVaFlat: string;
  /**
   * USDX token address on `chain`. This ALWAYS means the production token — it
   * is never swapped for the test one, in any mode. null when the chain isn't
   * configured backend-side.
   */
  contractAddress: string | null;
  /**
   * Test-mint token address, non-null ONLY while `mintMode === "TEST"`
   * (USDX-636). OPTIONAL: the field does not exist until that ships, and its
   * absence must read exactly like `null` — no test-mint strip.
   */
  testContractAddress?: string | null;
  /**
   * Whether THIS user may mint right now. While the test bundle runs, minting is
   * open only to a list of testers (USDX-636), so everyone else gets `false`.
   * OPTIONAL: absent means yes — an app that cannot see the field must behave
   * exactly as it did before the field existed.
   */
  mintAvailable?: boolean;
  /** Chain the address belongs to — "polygon" in Phase 2. */
  chain: string;
  /**
   * Mint bundle currently in force (USDX-636). OPTIONAL: the field only exists
   * once USDX-636 ships, and its absence means the normal production bundle.
   */
  mintMode?: "PROD" | "TEST";
}

// address-book.yaml AddressBookEntry — a saved mint destination wallet.
export interface AddressBookEntry {
  id: string;
  address: string;
  label: string;
  createdAt: string;
}

// bank-accounts.yaml BankAccountEntry — a saved redeem payout bank account
// (USDX-261). Parity with the address book; the account is PII (ciphertext at-rest),
// but the owner sees their own data — the number is returned in full and the bank
// name resolved from bankCode (un-mask 2026-06-25, USDX-269/270).
export interface BankAccountEntry {
  id: string;
  bankCode: string;
  bankName: string; // resolved from bankCode; falls back to the code when unknown
  accountNumber: string; // full number — owner sees their own data (un-mask 2026-06-25)
  accountName: string;
  label: string | null;
  createdAt: string;
}

// A saved Bank Account Book entry chosen as the redeem destination (USDX-267).
// Snapshot of the picked BankAccountEntry: redeem create sends only `id` (as
// `bankAccountId`, the saved path) while bankCode/bankName/number/name drive the
// read-only summary — the user never re-types the number (it's resolved server-side
// from the entry; the owner sees it in full — un-mask 2026-06-25).
export interface SelectedBankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

// One payment channel offered at create-time (VA carries a bank list; QRIS does not).
export interface MintChannelOption {
  channel: PaymentChannel;
  pgFeeIdr: string;
  banks: VaBank[] | null;
}

// Step-1 (create) response — satu-satunya bentuk order yang app pakai sekarang
// (pay + status detail dipegang repo `checkout`, USDX-225). PG fee + total-to-pay
// baru muncul setelah pilih channel di checkout, jadi tidak ada di sini.
export interface MintOrderCreated {
  id: string;
  orderNumber: string;
  customerName: string;
  userAddress: string;
  chain: string;
  amount: string; // decimal USDX
  baseRate: string;
  spreadBuyPct: string;
  effectiveRate: string;
  subtotalIdr: string;
  mintFeeIdr: string;
  totalBeforePgFeeIdr: string; // "Total Pembayaran" before the PG service fee
  paymentStatus: MintPaymentStatus;
  safeStatus: MintSafeStatus;
  status: MintOrderStatus;
  expiresAt: string;
  channels: MintChannelOption[];
}

// ── Phase 2 Week 3 — consumer redeem (USDX-243, redeem.yaml) ───────────────
// Redeem burns USDX on-chain (user self-signs) → IDR disbursed to the user's
// bank. The app builds the flow against the OpenAPI contract; the real on-chain
// burn + real API land in INT-1 (USDX-249). Monetary values are decimal strings
// (backend authoritative). Status enum = conventions.md § Status Enums → Redeem.
export type RedeemStatus =
  | "AWAITING_BURN" // order created, waiting for the on-chain burn
  | "BURNED" // Redeem event detected (amount matched)
  | "PROCESSING_PAYOUT" // disbursement created with the provider
  | "PAYOUT_COMPLETE" // payout confirmed
  // Payout rejected DEFINITIVELY by the provider (business 4xx on submit, or
  // checkStatus/webhook answering FAILED) — common.yaml § RedeemStatus rev
  // 2026-09-12, D22, backend#320 (USDX-471). Not a dead end: it means "waiting
  // for ops", who resolve it via RESEND (→ PROCESSING_PAYOUT), SETTLED_MANUAL
  // (→ PAYOUT_COMPLETE) or CLOSED (stays PAYOUT_FAILED). Transport failures never
  // reach it. The contract says clients MUST render it (USDX-664), so it stays out
  // of the tracker's STEPS and gets a state of its own.
  | "PAYOUT_FAILED"
  | "EXPIRED"; // AWAITING_BURN passed expires_at without a burn (late burn → BURNED)

// POST /api/v2/redeem response (redeem.yaml RedeemOrderCreated). Carries the
// on-chain args the FE needs to build the burn tx `redeem(redeemId, amountWei)`.
export interface RedeemOrderCreated {
  id: string;
  orderNumber: string; // = partner_reference_no (prefix RDM)
  customerName: string;
  chain: string;
  // Burn wallet bound at create (echo of the request `userAddress`, USDX-259);
  // the scanner only accepts a Redeem event from it.
  userAddress: string;
  // Jalur burn (redeem.yaml § RedeemOrderCreated.burnMode, USDX-565). Snapshot saat
  // create. Opsional di tipe: payload backend sebelum USDX-565 tidak membawanya,
  // dan yang tidak membawa dibaca SELF_SIGN — alur existing, bukan alur baru.
  burnMode?: BurnMode;
  contractAddress: string; // USDX proxy address on this chain
  redeemId: string; // bytes32 hex (0x-prefixed) — `id` arg for redeem(id, amount)
  amount: string; // decimal USDX
  amountWei: string; // uint256 string — `amount` arg for redeem(id, amount)
  baseRate: string;
  spreadSellPct: string;
  effectiveRate: string; // baseRate × (1 − spreadSellPct/100); = rateUsed
  grossIdr: string; // amount × effectiveRate (before fee)
  redeemFeePct: string;
  redeemFeeIdr: string;
  disbursementFeeIdr: string; // = provider service fee (reference in W3)
  totalFeeIdr: string; // redeemFeeIdr + disbursementFeeIdr
  netPayoutIdr: string; // grossIdr − totalFeeIdr (user receives; ≥ Rp 10.000, floor)
  bankCode: string;
  bankName: string; // resolved from bankCode (un-mask 2026-06-25, USDX-269/270)
  bankAccountNumber: string; // full number — owner sees their own data (un-mask 2026-06-25)
  bankAccountName: string; // user sees their own data
  // Apakah nama di `bankAccountName` datang dari JAWABAN inquiry provider atas nomor
  // rekening ini (redeem.yaml § RedeemOrderCreated / § RedeemOrder, sot#38, USDX-672).
  // `false` = itu nama yang diketik/disimpan nasabah, dipakai apa adanya karena
  // provider tidak menjawab nama (backend: `inquiry.accountName ?? bank.bankAccountName`
  // — provider MOCK meng-echo ketikan nasabah; adapter SNAP menjawab `null` kalau bank
  // tidak mengirim `beneficiaryAccountName`).
  //
  // Opsional di tipe: payload backend sebelum USDX-672 tidak membawanya. Yang tidak
  // membawa WAJIB dibaca seperti `false` — klaim "jawaban bank" hanya boleh dipasang
  // kalau response benar-benar mengatakannya, dan menahan klaim saat tidak tahu adalah
  // satu-satunya arah yang aman di layar yang seharusnya menangkap salah rekening.
  bankAccountNameVerified?: boolean;
  status: RedeemStatus;
  expiresAt: string;
}

// GET /api/v2/redeem/{id} — full order + live status (redeem.yaml RedeemOrder).
// Adds the on-chain / payout fields the status tracker polls. estimatedRevenue is
// backoffice-only and intentionally absent here.
export interface RedeemOrderDetail extends RedeemOrderCreated {
  type: ConsumerOrderType;
  // `userAddress` is inherited from RedeemOrderCreated (bound at create, USDX-259):
  // the burn source wallet the scanner cross-checks, and that resume requires the
  // reconnected wallet to equal.
  inputCurrency: AmountCurrency;
  lateBurn: boolean;
  // True once the user has burned past expires_at + REDEEM_LATE_BURN_GRACE
  // (week3.md § Week 3 Addendum): payout is held for manual reconcile (USDX-259).
  staleBurn: boolean;
  payoutProvider: string; // MOCK in W3
  payoutRef: string | null;
  burnTxHash: string | null;
  // Stamped when the FE reports the burn tx optimistically (POST .../burn-tx).
  // Status stays AWAITING_BURN until the scanner confirms — drives the "memproses
  // burn, menunggu konfirmasi on-chain" tracker copy (USDX-259).
  burnSubmittedAt: string | null;
  burnedAt: string | null;
  payoutCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// transactions.yaml TransactionItem — one history row, union mint + redeem
// (REDEEM effective W3, USDX-244). Which money fields are populated depends on
// `type`: MINT → subtotalIdr + totalPayIdr + paymentStatus (MintOrderStatus);
// REDEEM → grossIdr + netPayoutIdr + status (RedeemStatus), txHash = burn hash.
export interface ConsumerTransaction {
  id: string;
  type: ConsumerOrderType;
  amount: string; // decimal USDX
  subtotalIdr: string | null; // MINT: amount × effectiveBuyRate. Null for redeem.
  grossIdr: string | null; // REDEEM: amount × effectiveSellRate (pre-fee). Null for mint.
  totalPayIdr: string | null; // MINT: total paid (null before channel pick). REDEEM: null.
  netPayoutIdr: string | null; // REDEEM: IDR received (gross − fee). Null for mint.
  effectiveRate: string; // snapshot rate (buy for mint, sell for redeem)
  chain: string;
  // MINT: mint destination; REDEEM: burn source (USDX-645). Stored as created —
  // casing is not guaranteed (a mint can be all lowercase), so compare
  // case-insensitively (USDX-653, custodial-wallet.md §5.2).
  userAddress: string;
  paymentStatus: MintPaymentStatus | null; // MINT only. Null for redeem.
  status: MintOrderStatus | RedeemStatus; // MINT → MintOrderStatus; REDEEM → RedeemStatus
  txHash: string | null; // MINT: on-chain tx. REDEEM: burn tx.
  createdAt: string;
  updatedAt: string;
}

// Jenis baris riwayat terpadu `GET /api/v2/transactions` (common.yaml § HistoryItemType,
// custodial-wallet.md §5.7, USDX-713). Sengaja BUKAN perluasan `ConsumerOrderType`:
// transfer bukan order (pelajaran USDX-464). Enum bisa bertambah — baris ber-`type`
// tak dikenal dilewati di `lib/history-item.ts`, tidak membuat halaman crash.
export type HistoryItemType = ConsumerOrderType | "TRANSFER_IN" | "TRANSFER_OUT";

// transactions.yaml § TransferHistoryItem — satu transfer USDX wallet custodial di
// riwayat terpadu. `counterpartyAddress` = PENGIRIM untuk TRANSFER_IN, TUJUAN untuk
// TRANSFER_OUT (alamat saja, tidak pernah nama user lain). `status`/`failureReason`
// diketik longgar seperti `WalletTransfer`: hanya `lib/wallet-transfer.ts` yang
// menafsirkannya (nilai tak dikenal = PENDING).
export interface TransferHistoryItem {
  id: string; // TRANSFER_OUT = WalletTransfer.id (detail /send/history/[id])
  type: "TRANSFER_IN" | "TRANSFER_OUT";
  amount: string; // decimal USDX, selalu 6 desimal
  amountWei: string;
  chain: string;
  userAddress: string; // wallet custodial milik user (informasi saja)
  counterpartyAddress: string;
  txHash: string;
  status: WalletTransferStatus | (string & {});
  failureReason: WalletTransferFailureReason | (string & {}) | null;
  blockNumber: number | null;
  createdAt: string; // OUT = submittedAt; IN = stempel waktu blok
  updatedAt: string;
}

// Satu baris /history: order (mint/redeem) atau transfer.
export type HistoryItem = ConsumerTransaction | TransferHistoryItem;
