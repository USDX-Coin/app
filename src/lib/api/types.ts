import type { AmountCurrency, EntityType, HistoryItemType } from "@/types";
import type {
  AnnualIncomeRange,
  NetWorthRange,
  Occupation,
  SourceOfFunds,
  SourceOfWealth,
  TransactionPurpose,
} from "@/lib/kyc/cdd";
import type { Gender, IdentityType, MaritalStatus } from "@/lib/kyc/identity";

// ── Auth (openapi auth.yaml — Auth v2 / consumer) ──────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  entityType: EntityType; // INDIVIDUAL only in Week 1
  agreeToS: boolean;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}

// changePasswordV2 (auth.yaml, USDX-172) — in-app password change for a logged-in
// user. bearerAuth, unlike the public reset-password flow. Field naming mirrors
// ResetPasswordRequest so validators/error mapping stay shared.
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// ── PIN akun (openapi pin.yaml — set / change, USDX-651) ───────────────────
// Keduanya session-gated; body hanya PIN, user diambil dari sesi. PIN 6 digit
// numerik (`^[0-9]{6}$`); bentuk salah → 422 VALIDATION_ERROR tanpa membakar
// attempt lockout `pin`.

// POST /api/v2/auth/pin/set. First-time set (akun belum punya PIN) cukup sesi
// valid dan `currentPin` diabaikan. Menimpa PIN yang sudah ada butuh re-auth:
// sesi password-auth segar ATAU `currentPin` benar; keduanya absen → 401
// REAUTH_REQUIRED. FE memakai endpoint ini hanya untuk first-time set — rotasi
// PIN lewat `ChangePinRequest`.
export interface SetPinRequest {
  pin: string;
  currentPin?: string;
}

// POST /api/v2/auth/pin/change — rotasi PIN, gated PIN lama (lockout scope `pin`
// bersama transfer/redeem). `newPin` WAJIB beda dari `currentPin` (422 PIN_UNCHANGED).
export interface ChangePinRequest {
  currentPin: string;
  newPin: string;
}

// ── 2FA TOTP (openapi two-factor.yaml, USDX-714) ───────────────────────────
// Field `code` di semua body di bawah = rahasia (TOTP / backup code / OTP email):
// tidak pernah dicatat di log / analytics klien (custodial-wallet.md §6.1 "Log").

// POST /api/v2/auth/2fa/enable dan /backup-codes/regenerate — password-gated.
export interface TwoFactorPasswordRequest {
  password: string;
}

// POST /api/v2/auth/2fa/verify (finalisasi enroll, TOTP 6 digit) dan
// /verify-login (TOTP atau backup code).
export interface TwoFactorCodeRequest {
  code: string;
}

// POST /api/v2/auth/2fa/disable — konfirmasi SALAH SATU: password ATAU kode TOTP
// (either/or, keputusan PM — tidak diperketat).
export type DisableTwoFactorRequest = { password: string } | { code: string };

// POST /api/v2/auth/2fa/recovery/email — tanpa `code` = kirim OTP ke email;
// dengan `code` = verifikasi OTP → 2FA dimatikan (tanpa token; login ulang).
export interface TwoFactorRecoveryRequest {
  code?: string;
}

// ── KYC (openapi kyc.yaml — consumer) ──────────────────────────────────────
// `IdentityType` hidup di `@/lib/kyc/identity` bersama daftar nilai + validasinya,
// dan di-re-export di sini supaya modul yang hanya bicara soal bentuk wire tidak
// perlu tahu asalnya.
export type { IdentityType };

export interface SubmitKycRequest {
  // --- Identitas (kyc.yaml § SubmitKycRequest, POJK 8/2023 Pasal 25 (1) a) ------
  firstName: string;
  lastName: string;
  // PII, nullable — butir a) "termasuk nama alias, JIKA ADA".
  aliasName: string | null;
  dob: string; // YYYY-MM-DD
  birthPlace: string;
  identityType: IdentityType;
  identityNumber: string;
  // Kewarganegaraan (butir e), ISO 3166-1 alpha-2 huruf besar. BUKAN duplikat
  // `country`: itu negara alamat tinggal (butir c), ini kewarganegaraan orangnya.
  nationality: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  // PII. Wajib — butir j) tidak punya kualifikasi "jika ada".
  mothersMaidenName: string;
  country: string; // ISO 3166-1 alpha-2; "ID" di Phase 2 awal
  addressLine1: string;
  addressLine2: string | null;
  ktpObjectKey: string;
  selfieObjectKey: string;

  // --- Blok CDD (USDX-545, diperluas USDX-586) ---------------------------------
  // Bentuknya persis `KycCddFields` di kyc.yaml — satu deklarasi di sana dipakai
  // dua endpoint, jadi bidang di bawah harus identik dengan `SubmitKycCddRequest`.
  occupation: Occupation;
  sourceOfFunds: SourceOfFunds;
  annualIncomeRange: AnnualIncomeRange;
  netWorthRange: NetWorthRange;
  transactionPurpose: TransactionPurpose;
  // Nullable: opsional secara umum, WAJIB saat `pepStatus` true (Pasal 37 (1) d).
  sourceOfWealth: SourceOfWealth | null;
  // PII, nullable: butir g) "tempat kerja, JIKA ADA".
  employerAddress: string | null;
  employerPhone: string | null;
  pepStatus: boolean;
  // PII, nullable: hanya dikirim saat pepStatus true.
  pepRelation: string | null;
  // PII, nullable: opsional — hanya nasabah yang punya NPWP.
  npwp: string | null;
}

/**
 * Body top-up CDD (USDX-545): nasabah yang identitasnya SUDAH VERIFIED mengisi
 * jawaban due diligence yang tidak pernah ditanyakan kepadanya.
 *
 * Persis subset CDD dari `SubmitKycRequest` — tanpa identitas, tanpa object key.
 * Mengirimnya lewat endpoint submit biasa bukan pilihan: endpoint itu menulis
 * `status = PENDING`, yang akan menjatuhkan nasabah terverifikasi kembali ke antrean
 * review.
 *
 * Lima field identitas baru USDX-586 sengaja TIDAK ada di sini: kyc.yaml menaruhnya
 * di bagian identitas `SubmitKycRequest`, dan endpoint ini tidak boleh berkuasa
 * mengubah data identitas yang sudah disetujui tanpa review.
 */
export interface SubmitKycCddRequest {
  occupation: Occupation;
  sourceOfFunds: SourceOfFunds;
  annualIncomeRange: AnnualIncomeRange;
  netWorthRange: NetWorthRange;
  transactionPurpose: TransactionPurpose;
  sourceOfWealth: SourceOfWealth | null;
  employerAddress: string | null;
  employerPhone: string | null;
  pepStatus: boolean;
  pepRelation: string | null;
  npwp: string | null;
}

// ── Storage (openapi storage.yaml — consumer) ──────────────────────────────
export type PresignedDocKind = "ktp" | "selfie";

export interface PresignedUploadRequest {
  docKind: PresignedDocKind;
  fileType: string; // MIME, e.g. image/jpeg
  sizeBytes: number; // max 5_242_880
}

export interface PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
  headers?: Record<string, string>;
}

// ── Mint / Redeem (legacy W1-era mock shapes — used by the not-yet-migrated
// mint/redeem pages until USDX-201/W3 swap them) ───────────────────────────
export interface CreateMintRequest {
  chainId: string;
  amount: number;
  destinationAddress: string;
}

export interface CreateRedeemRequest {
  chainId: string;
  amount: number;
  bankAccountId: string;
  walletAddress: string;
}

// ── Phase 2 Week 2 — consumer mint v2 + address book (USDX-205) ─────────────
// Request bodies for the real `/api/v2/*` client modules (mint-api, address-book-api).
// openapi mint.yaml CreateMintOrderV2, address-book.yaml.

export interface CreateMintOrderRequest {
  userAddress: string; // EVM address (manual / address book); stored as-is
  amount: string; // decimal — USD = USDX amount, IDR = subtotal (mint value)
  amountCurrency: AmountCurrency;
  chain: string; // Phase 2 = Polygon-only → FE sends "polygon" (hardcoded)
}

export interface CreateAddressBookRequest {
  address: string;
  label: string; // max 50 chars
}

// ── Phase 2 Week 3 — consumer redeem v2 (USDX-243, hardened USDX-259) ────────
// POST /api/v2/redeem body (redeem.yaml CreateRedeemOrder). Bank fields are
// encrypted PII server-side; the FE sends them plaintext over TLS.
export interface CreateRedeemOrderRequest {
  amount: string; // decimal — USD = USDX amount (burned), IDR = gross_idr (sale value)
  amountCurrency: AmountCurrency;
  chain: string; // Phase 2 = Polygon-only → FE sends "polygon" (hardcoded)
  // Connected wallet that will burn (week3.md § Week 3 Addendum, USDX-259). The
  // backend binds the order to it (user_address), pre-checks balance + blacklist,
  // and the scanner only accepts a Redeem event from this address.
  userAddress: string;
  // Bank destination — two-path (redeem.yaml CreateRedeemOrder, USDX-262/267). Send
  // EXACTLY one path: `bankAccountId` (saved Bank Account Book entry — the backend
  // resolves + decrypts the number/name server-side, so the FE never re-sends the PII)
  // OR the manual trio below. `bankAccountId` is authoritative; `bankAccountNumber`
  // must never accompany it (→ 422 VALIDATION_ERROR), and `bankCode`/`bankAccountName`
  // sent alongside must match the entry. Omitted fields are dropped from the body.
  bankAccountId?: string; // saved path — entry id (bank-accounts.yaml)
  bankCode?: string; // manual path — destination bank (provider-specific code)
  bankAccountNumber?: string; // manual path — account number (plaintext over TLS)
  bankAccountName?: string; // manual path — holder name (plaintext over TLS)
  // Jalur CUSTODIAL saja (redeem.yaml § CreateRedeemOrder.pin, USDX-565/567):
  // `userAddress` = wallet custodial user → PIN 6-digit WAJIB dan diverifikasi di
  // langkah ini — satu-satunya titik persetujuan user, karena setelahnya tidak
  // ada layar tanda tangan wallet. Diabaikan backend di jalur SELF_SIGN; FE tidak
  // mengirimkannya di sana (field dihilangkan dari body).
  pin?: string;
  // Jalur CUSTODIAL saja, bersama `pin` (redeem.yaml § CreateRedeemOrder.twoFactorCode,
  // custodial-wallet.md §6.1, USDX-717): kode authenticator 6 digit ATAU backup code.
  // Tidak ada idempotency key di endpoint ini — satu kode TOTP menyetujui satu order.
  twoFactorCode?: string;
}

// ── Gelombang 1 Custodial Wallet — transfer (USDX-567) ───────────────────────
// POST /api/v2/wallet/transfer body (wallet.yaml § CreateTransfer). Tidak ada
// `chain` (Polygon-only, wallet custodial hanya ada di satu chain) dan tidak ada
// `amountCurrency` (transfer memindahkan token, bukan menjual/membeli). Header
// `Idempotency-Key` WAJIB dan dibawa terpisah oleh `transferCustodial` — bukan
// bagian body. "Body sama" untuk replay = `to` + `amount`; `pin` dan
// `twoFactorCode` bukan identitas niat transfer.
export interface CreateTransferRequest {
  to: string; // EVM address tujuan; address custodial sendiri → 422 VALIDATION_ERROR
  amount: string; // decimal USDX, positif, maks 6 desimal
  pin: string; // PIN 6-digit akun (pin.yaml); berbagi lockout scope `pin`
  // Kode authenticator 6 digit ATAU backup code (wallet.yaml § CreateTransfer.
  // twoFactorCode, custodial-wallet.md §6.1, USDX-717). Wajib secara aturan, opsional
  // di tipe: backend lama membuangnya diam-diam (urutan rilis FE → BE). Retry dengan
  // Idempotency-Key yang sama boleh membawa kode baru.
  twoFactorCode?: string;
}

// POST /api/v2/redeem/{id}/burn-tx body (redeem.yaml redeemV2BurnTx, USDX-259).
// FE reports the burn tx hash optimistically right after broadcast; status stays
// AWAITING_BURN (the scanner remains the source of truth for BURNED).
export interface ReportBurnTxRequest {
  txHash: string; // 0x-prefixed redeem tx hash
}

// POST /api/v2/bank-accounts body (bank-accounts.yaml CreateBankAccountEntry,
// USDX-261). account fields are encrypted PII server-side; sent plaintext over TLS.
export interface CreateBankAccountRequest {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  label?: string; // optional, max 50 chars
}

export interface ListTransactionsParams {
  page?: number;
  take?: number; // 1..50, default 10
  // Satu jenis saja (transactions.yaml § list). Diisi → `includeTransfers` diabaikan.
  type?: HistoryItemType;
  // Hanya berlaku tanpa `type`: true → transfer masuk/keluar ikut digabung (tab
  // "Semua"). Kosong = mint + redeem saja, perilaku lama (USDX-713).
  includeTransfers?: boolean;
}

