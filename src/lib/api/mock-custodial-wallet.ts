// ── Mock wallet custodial (wallet.yaml, USDX-566) ────────────────────────────
// Stand-in untuk `POST/GET /api/v2/wallet`. Satu wallet per browser (bukan per
// akun — cukup untuk mock), disimpan di localStorage ("usdx-mock-custodial")
// supaya bertahan melintasi `page.goto` Playwright: alur register → verifikasi →
// dikasih wallet → poll → ACTIVE → sidebar menempuh beberapa muatan halaman, dan
// state modul hilang pada tiap muatan. Di luar browser (SSR) jatuh ke variabel
// modul.
//
// State machine mengikuti kontrak: `POST` → PROVISIONING (address null);
// PROVISIONING berpindah ke ACTIVE sendiri MOCK_PROVISIONING_MS setelah dibuat
// (dibaca saat GET berikutnya, meniru forward status USDX-579). Tidak ada
// keadaan gagal — persis SOT §5.5 — jadi seam `stuck` yang memerankan
// "provisioning macet": GET tidak pernah berpindah, dan `POST` ulang
// (tombol coba lagi) yang menyembuhkannya (§5.5: respons POST menyegarkan
// salinan kerja). Seam terpisah "usdx-mock-custodial-fail-create" memerankan
// 503 WALLET_SERVICE_UNAVAILABLE satu kali pada POST berikutnya — terpisah dari
// state wallet karena kasus yang penting justru "belum punya wallet, POST
// pertama gagal, tawaran tetap di layar, POST kedua berhasil".
//
// Seam Playwright: `seedCustodialWallet` / `seedCustodialCreateFailure` di
// tests/helpers/playwright-utils.ts. Mock-only — backend sungguhan memegang
// state ini.
//
// File sendiri, bukan seksi di mock-api.ts: file itu sudah 1.300 baris sebelum
// tiket ini (engineering-standards Lapis 3 #3: >500 baris = justifikasi tertulis),
// dan bagian ini hanya bergantung pada `ApiError` + `USDX_DECIMALS`. mock-api.ts
// mengimpor `withCustodialWallet` dari sini — arah impor satu jalur, tanpa siklus.

import type {
  CustodialWallet,
  CustodialWalletSummary,
  TransferAccepted,
  User,
  WalletTransfer,
} from "@/types";
import type { CreateTransferRequest } from "./types";
import { ApiError, type Paginated } from "./client";
import {
  getMockWalletTransfer,
  listMockWalletTransfers,
  recordMockWalletTransfer,
  resetMockWalletTransfers,
  type MockTransferOutcome,
} from "./mock-wallet-transfers";
import { isMockPinSet, resetMockPin, verifyMockPin } from "./mock-pin";
import { USDX_DECIMALS } from "@/lib/constants";
import { uuidv7 } from "@/lib/uuid";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET /api/v2/config (USDX-635) `contractAddress` — the production token. The
// address mirrors what a deployed backend would return for Polygon; offline it
// only has to be a well-formed address, and it deliberately matches nothing
// real so a mock balance read stays empty. The custodial wallet reports the
// same address as its `contractAddress` (wallet.yaml: "asal angka balance").
export const MOCK_CONTRACT_ADDRESS = "0x1FF2000000000000000000000000000000000000";

const CUSTODIAL_SEAM_KEY = "usdx-mock-custodial";
const CUSTODIAL_FAIL_CREATE_KEY = "usdx-mock-custodial-fail-create";
export const MOCK_CUSTODIAL_ADDRESS = "0x000000C528aE908fB929a0898B65e913623c9aFf";
export const MOCK_PROVISIONING_MS = 1_500;

export interface MockCustodialState {
  status: CustodialWallet["status"];
  address: string | null;
  createdAt: string;
  // Epoch ms saat PROVISIONING boleh berpindah ke ACTIVE (dibaca saat GET).
  activateAt: number | null;
  // Saldo USDX desimal setelah ACTIVE. `null` = RPC "tak terjangkau" — kontrak
  // menuntut UI merender "—", bukan 0.
  balance: string | null;
  // Seam: PROVISIONING tidak pernah berpindah sampai POST ulang.
  stuck?: boolean;
  // ── Seam USDX-567 (transfer / redeem custodial) ──
  // (PIN akun tidak di sini — lihat `mock-pin.ts`: PIN milik akun, bukan wallet.)
  // Zona kunci mati → transfer → 503 WALLET_SERVICE_UNAVAILABLE.
  serviceDown?: boolean;
  // Jaringan padat (§5.4) → transfer BERIKUTNYA → 503 NETWORK_CONGESTED, lalu "reda".
  networkCongested?: boolean;
  // Plafon §6 (kosong = tanpa batas, seperti env backend).
  transferLimit?: { perTx?: string; daily?: string };
  // Transfer pertama tiap key menggantung dulu (409 IN_PROGRESS), lalu selesai.
  slowFirstTransfer?: boolean;
  // ── Seam USDX-701 (tracker konfirmasi) ──
  // Keputusan "watcher" untuk transfer BERIKUTNYA (default CONFIRMED). "PENDING" =
  // macet selamanya; nilai lain = status yang belum dikenal FE (mock-wallet-transfers.ts).
  transferOutcome?: MockTransferOutcome;
}

let custodialMemory: MockCustodialState | null = null;

function readCustodialState(): MockCustodialState | null {
  if (typeof localStorage === "undefined") return custodialMemory;
  try {
    const raw = localStorage.getItem(CUSTODIAL_SEAM_KEY);
    return raw ? (JSON.parse(raw) as MockCustodialState) : null;
  } catch {
    return null;
  }
}

function writeCustodialState(state: MockCustodialState | null) {
  custodialMemory = state;
  if (typeof localStorage === "undefined") return;
  if (state === null) localStorage.removeItem(CUSTODIAL_SEAM_KEY);
  else localStorage.setItem(CUSTODIAL_SEAM_KEY, JSON.stringify(state));
}

// Dipakai unit test untuk mengembalikan mock ke "user tanpa wallet" (dan
// membersihkan kunci idempotensi + PIN akun/lockout dari test sebelumnya).
export function resetMockCustodialWallet() {
  writeCustodialState(null);
  transferRequests.clear();
  resetMockPin();
  resetMockWalletTransfers();
  dailyTransferredUsdx = 0;
}

// Unit test USDX-567: pasang wallet yang SUDAH ada. Tanpa argumen = ACTIVE,
// saldo 1.000 USDX (onboarding-nya sendiri diuji lewat `mockCreateCustodialWallet`;
// PIN akun diatur terpisah lewat `seedMockPin` di mock-pin.ts).
export function seedMockCustodialWallet(
  overrides: Partial<MockCustodialState> = {},
): MockCustodialState {
  const state: MockCustodialState = {
    status: "ACTIVE",
    address: MOCK_CUSTODIAL_ADDRESS,
    createdAt: "2026-08-28T04:10:00.000Z",
    activateAt: null,
    balance: "1000.00",
    ...overrides,
  };
  writeCustodialState(state);
  return state;
}

// Punya baris di salinan kerja (`custodial_wallet_mirror`), status APA PUN — yang
// dibaca gerbang first-time set pin.yaml § set (backend USDX-698, seam mock-pin).
export function hasMockCustodialWallet(): boolean {
  return readCustodialState() !== null;
}

// PROVISIONING → ACTIVE berjalan "di latar" (wallet-service), terlihat saat GET.
function settleCustodialState(state: MockCustodialState): MockCustodialState {
  if (
    state.status === "PROVISIONING" &&
    !state.stuck &&
    state.activateAt !== null &&
    Date.now() >= state.activateAt
  ) {
    const next: MockCustodialState = {
      ...state,
      status: "ACTIVE",
      address: MOCK_CUSTODIAL_ADDRESS,
      activateAt: null,
      balance: state.balance ?? "0.00",
    };
    writeCustodialState(next);
    return next;
  }
  return state;
}

function custodialSummary(): CustodialWalletSummary | null {
  const state = readCustodialState();
  if (!state) return null;
  const settled = settleCustodialState(state);
  return { address: settled.address, status: settled.status };
}

// `users.yaml § User.custodialWallet` + `pinSet` — ikut terbawa di /auth/me +
// respons login/verify/reset, null untuk user tanpa wallet.
export function withCustodialWallet(user: User): User {
  return {
    ...user,
    custodialWallet: custodialSummary(),
    pinSet: isMockPinSet(),
  };
}

function toCustodialWallet(state: MockCustodialState): CustodialWallet {
  const readable = state.status !== "PROVISIONING" && state.balance !== null;
  return {
    address: state.address,
    status: state.status,
    chain: "polygon",
    contractAddress: MOCK_CONTRACT_ADDRESS,
    balance: readable ? state.balance : null,
    balanceWei: readable ? String(Math.round(Number(state.balance) * 10 ** USDX_DECIMALS)) : null,
    balanceAt: readable ? new Date().toISOString() : null,
    createdAt: state.createdAt,
  };
}

export async function mockGetCustodialWallet(): Promise<CustodialWallet> {
  await delay(150);
  const state = readCustodialState();
  if (!state) {
    throw new ApiError(404, "WALLET_NOT_FOUND", "Kamu belum punya wallet custodial");
  }
  return toCustodialWallet(settleCustodialState(state));
}

// Satu kali: seam gugur begitu dipakai, jadi klik "coba lagi" berikutnya lolos.
function consumeCreateFailure(): boolean {
  if (typeof localStorage === "undefined") return false;
  if (localStorage.getItem(CUSTODIAL_FAIL_CREATE_KEY) === null) return false;
  localStorage.removeItem(CUSTODIAL_FAIL_CREATE_KEY);
  return true;
}

export async function mockCreateCustodialWallet(): Promise<CustodialWallet> {
  await delay(300);
  if (consumeCreateFailure()) {
    throw new ApiError(
      503,
      "WALLET_SERVICE_UNAVAILABLE",
      "Layanan wallet sedang tidak tersedia, coba lagi sebentar",
    );
  }
  const state = readCustodialState();
  if (state) {
    const settled = settleCustodialState(state);
    if (settled.status === "ACTIVE") {
      throw new ApiError(409, "WALLET_ALREADY_EXISTS", "Kamu sudah punya wallet custodial");
    }
    if (settled.status === "SUSPENDED") {
      throw new ApiError(409, "WALLET_SUSPENDED", "Wallet custodial kamu ditangguhkan");
    }
    // Masih PROVISIONING → 202 yang sama, BUKAN 409 — dan POST-lah yang
    // menyegarkan salinan kerja (§5.5): yang macet dilepas di sini.
    const healed: MockCustodialState = {
      ...settled,
      stuck: false,
      activateAt: Date.now() + MOCK_PROVISIONING_MS,
    };
    writeCustodialState(healed);
    return toCustodialWallet(healed);
  }
  const created: MockCustodialState = {
    status: "PROVISIONING",
    address: null,
    createdAt: new Date().toISOString(),
    activateAt: Date.now() + MOCK_PROVISIONING_MS,
    balance: null,
  };
  writeCustodialState(created);
  return toCustodialWallet(created);
}

// ── USDX-567: PIN, saldo untuk redeem, transfer ─────────────────────────────
// Bagian di bawah dipakai `mockTransferCustodial` (di sini) dan jalur redeem
// custodial di mock-api.ts (lewat helper yang diekspor) — arah impor tetap satu
// jalur: mock-api → file ini.

// Sentinel address ter-blacklist on-chain (`isBlackListed`), dipakai mock mint
// (422 RECIPIENT_BLACKLISTED), redeem (422 WALLET_BLACKLISTED) dan transfer.
// Dihosting di sini supaya transfer bisa memakainya tanpa mengimpor mock-api.
export const MOCK_BLACKLISTED_ADDRESS = "0x000000000000000000000000000000000000dead";
// Seam `slowFirstTransfer`: transfer pertama sebuah key "masih berjalan" selama ini
// (409 IDEMPOTENCY_KEY_IN_PROGRESS), lalu selesai — retry dengan key yang SAMA
// mendapat hasilnya. Meniru dua request identik yang berangkat bersamaan.
const MOCK_TRANSFER_INFLIGHT_MS = 1_500;

const idr = (n: number) => n.toFixed(2);
function toUsdxWei(amountUsdx: number): string {
  return BigInt(Math.round(amountUsdx * 10 ** USDX_DECIMALS)).toString();
}
function randomHex(bytes: number): string {
  let hex = "";
  for (let i = 0; i < bytes * 2; i++) hex += Math.floor(Math.random() * 16).toString(16);
  return hex;
}

// Seam throttle 429 RATE_LIMITED (USDX-252) — pembacaan yang sama dengan
// `maybeThrowRateLimited` di mock-api.ts; diulang di sini agar tanpa impor siklik.
function maybeThrowRateLimited(): void {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem("usdx-mock-ratelimit");
  if (raw === null) return;
  const seconds = Number(raw);
  throw new ApiError(
    429,
    "RATE_LIMITED",
    "Terlalu banyak request, coba lagi sebentar",
    undefined,
    Number.isFinite(seconds) && seconds > 0 ? seconds : 1,
  );
}

// Id user sesi (kunci idempotensi hanya berlaku untuk pemiliknya). Mock hanya
// punya satu akun demo; sesi yang diseed Playwright dibaca dari `usdx-auth`.
function currentMockUserId(): string {
  if (typeof localStorage === "undefined") return "usr_1";
  try {
    const raw = localStorage.getItem("usdx-auth");
    return (raw && (JSON.parse(raw)?.state?.user?.id as string)) || "usr_1";
  } catch {
    return "usr_1";
  }
}

// Wallet custodial user yang ACTIVE, atau lempar 409 WALLET_NOT_ACTIVE. Null kalau
// user tidak punya wallet — pemanggil memutuskan (transfer → 404; redeem → jalur
// SELF_SIGN biasa).
export function requireActiveCustodialWallet(): MockCustodialState | null {
  const state = readCustodialState();
  if (!state) return null;
  const settled = settleCustodialState(state);
  if (settled.status !== "ACTIVE" || !settled.address) {
    throw new ApiError(409, "WALLET_NOT_ACTIVE", "Wallet custodial belum aktif");
  }
  return settled;
}

export function isMockCustodialAddress(address: string | undefined | null): boolean {
  const state = readCustodialState();
  return (
    !!address && !!state?.address && address.toLowerCase() === state.address.toLowerCase()
  );
}

// Saldo custodial untuk pre-check redeem di mock-api; null = tak terbaca.
export function mockCustodialBalanceUsdx(): number | null {
  const bal = readCustodialState()?.balance;
  return bal == null ? null : Number(bal);
}

// Dispatcher burn custodial (mock-api) menurunkan saldo sebesar yang dibakar.
export function debitMockCustodialBalance(amountUsdx: number): void {
  const state = readCustodialState();
  if (state?.balance == null) return;
  writeCustodialState({ ...state, balance: idr(Math.max(0, Number(state.balance) - amountUsdx)) });
}

// ── Transfer custodial (wallet.yaml § POST /api/v2/wallet/transfer) ──────────
// Idempotensi ditegakkan seperti kontrak: key disimpan, baris "in-flight" ditulis
// SEBELUM "tanda tangan". Per page load (modul) — cukup untuk retry dalam satu
// sesi form, yang memang satu-satunya tempat FE memakai ulang key.
interface MockTransferRequest {
  userId: string;
  bodyKey: string; // `to` (lowercase) + `amount` — `pin` bukan identitas niat
  settleAt: number; // epoch ms saat "broadcast" selesai
  result: TransferAccepted | null; // null selama masih berjalan
}
const transferRequests = new Map<string, MockTransferRequest>();
let dailyTransferredUsdx = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USDX_AMOUNT_REGEX = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;

export async function mockTransferCustodial(
  req: CreateTransferRequest,
  idempotencyKey: string,
): Promise<TransferAccepted> {
  await delay(400);
  maybeThrowRateLimited(); // 429 RATE_LIMITED — grup `wallet` (seam USDX-252)

  // 1. Validasi bentuk (header + body) — sebelum PIN, jadi tidak membakar attempt.
  if (!UUID_REGEX.test(idempotencyKey)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Idempotency-Key harus UUID");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(req.to)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Address tujuan tidak valid");
  }
  if (!USDX_AMOUNT_REGEX.test(req.amount) || Number(req.amount) <= 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Jumlah tidak valid");
  }
  if (!/^[0-9]{6}$/.test(req.pin)) {
    throw new ApiError(422, "VALIDATION_ERROR", "PIN harus 6 digit");
  }
  if (!readCustodialState()) {
    // FE menawarkan transfer pada user tanpa wallet = bug alur, bukan keadaan user.
    throw new ApiError(404, "WALLET_NOT_FOUND", "Kamu belum punya wallet custodial");
  }
  if (isMockCustodialAddress(req.to)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Tidak bisa transfer ke wallet sendiri");
  }

  // 2. PIN (lockout scope `pin`).
  verifyMockPin(req.pin);

  // 3. Replay / kunci idempotensi — SEBELUM pre-check yang bergantung keadaan
  //    dunia (saldo sudah turun karena transfer pertamanya berhasil).
  const userId = currentMockUserId();
  const bodyKey = `${req.to.toLowerCase()}|${req.amount}`;
  const held = transferRequests.get(idempotencyKey);
  if (held) {
    if (held.userId !== userId || held.bodyKey !== bodyKey) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Idempotency-Key sudah dipakai untuk transfer lain",
      );
    }
    if (held.result === null && Date.now() < held.settleAt) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_IN_PROGRESS",
        "Transfer dengan Idempotency-Key ini masih berjalan",
      );
    }
    if (held.result) return held.result; // replay → hasil identik (200)
  }

  // 4. Status salinan kerja → plafon → blacklist → saldo.
  const active = requireActiveCustodialWallet()!;
  const amount = Number(req.amount);
  const limit = active.transferLimit;
  if (limit?.perTx != null && amount > Number(limit.perTx)) {
    throw new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "Melebihi batas transfer per transaksi", {
      limitType: "PER_TX",
      limit: limit.perTx,
      remaining: limit.perTx,
      resetAt: null,
    });
  }
  if (limit?.daily != null && dailyTransferredUsdx + amount > Number(limit.daily)) {
    const midnight = new Date();
    midnight.setUTCHours(17, 0, 0, 0); // tengah malam WIB berikutnya (UTC+7)
    if (midnight.getTime() <= Date.now()) midnight.setUTCDate(midnight.getUTCDate() + 1);
    throw new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "Melebihi batas transfer harian", {
      limitType: "DAILY",
      limit: limit.daily,
      remaining: idr(Math.max(0, Number(limit.daily) - dailyTransferredUsdx)),
      resetAt: midnight.toISOString(),
    });
  }
  if (req.to.toLowerCase() === MOCK_BLACKLISTED_ADDRESS) {
    throw new ApiError(422, "RECIPIENT_BLACKLISTED", "Address tujuan tidak dapat menerima USDX");
  }
  const balance = active.balance === null ? null : Number(active.balance);
  if (balance !== null && balance < amount) {
    throw new ApiError(422, "INSUFFICIENT_BALANCE", "Saldo USDX tidak cukup");
  }
  if (active.serviceDown) {
    throw new ApiError(
      503,
      "WALLET_SERVICE_UNAVAILABLE",
      "Layanan wallet sedang tidak tersedia, coba lagi sebentar",
    );
  }
  if (active.networkCongested) {
    // §5.4/§11: ditolak sebelum tanda tangan, baris REJECTED → kunci dilepas; sekali saja.
    writeCustodialState({ ...active, networkCongested: false });
    const msg = "Jaringan blockchain sedang padat, coba lagi beberapa menit lagi";
    throw new ApiError(503, "NETWORK_CONGESTED", msg);
  }

  // 5. Tulis baris in-flight (menang di "unique index"), lalu "sign & broadcast".
  const settleAt = Date.now() + (active.slowFirstTransfer && !held ? MOCK_TRANSFER_INFLIGHT_MS : 0);
  const row: MockTransferRequest = { userId, bodyKey, settleAt, result: null };
  transferRequests.set(idempotencyKey, row);
  if (Date.now() < settleAt) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_IN_PROGRESS",
      "Transfer dengan Idempotency-Key ini masih berjalan",
    );
  }
  const result: TransferAccepted = {
    id: uuidv7(),
    txHash: "0x" + randomHex(32),
    from: active.address!,
    to: req.to,
    amount: idr(amount),
    amountWei: toUsdxWei(amount),
    chain: "polygon",
    submittedAt: new Date().toISOString(),
  };
  row.result = result;
  // Riwayat (USDX-701): baris PENDING yang diputuskan "watcher" belakangan.
  recordMockWalletTransfer(result, userId, active.transferOutcome);
  dailyTransferredUsdx += amount;
  if (balance !== null) writeCustodialState({ ...active, balance: idr(balance - amount) });
  return result;
}

// ── Riwayat & tracker (wallet.yaml § transfers / transfer-detail, USDX-701) ──
// Buku besarnya di mock-wallet-transfers.ts; di sini hanya pintu yang tahu siapa
// user sesi + throttle grup `wallet`. Seperti kontrak: tanpa gate wallet (user
// tanpa wallet = daftar kosong) dan tanpa 503 (tidak menyentuh zona kunci).
export async function mockListWalletTransfers(params: {
  page?: number;
  take?: number;
}): Promise<Paginated<WalletTransfer>> {
  await delay(150);
  maybeThrowRateLimited();
  return listMockWalletTransfers(currentMockUserId(), params);
}

export async function mockGetWalletTransfer(id: string): Promise<WalletTransfer> {
  await delay(150);
  maybeThrowRateLimited();
  return getMockWalletTransfer(currentMockUserId(), id);
}
