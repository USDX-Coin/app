// ── Mock PIN akun (pin.yaml — Pintu Depan / persetujuan transaksi) ───────────
// PIN 6 digit adalah milik AKUN (`users.pin_hash`, users.yaml § User.pinSet),
// bukan milik wallet: user tanpa wallet custodial pun membuat PIN dari
// Pengaturan (USDX-651). Karena itu state-nya hidup di sini, bukan menumpang seam
// `pinSet` di state wallet `mock-custodial-wallet.ts` seperti pada USDX-567.
//
// Disimpan di localStorage ("usdx-mock-pin") supaya bertahan melintasi `page.goto`
// Playwright: buat PIN di Pengaturan → pindah ke /send → transfer memakai PIN yang
// baru dibuat. Di luar browser (SSR / unit tanpa localStorage) jatuh ke variabel
// modul.
//
// Catatan ABSEN = akun demo dengan PIN bawaan `MOCK_PIN` — perilaku 567
// dipertahankan, semua spec lama berjalan dengan PIN 123456 tanpa seeding.
// `{ pin: null }` = akun belum punya PIN (401 PIN_NOT_SET).
//
// Lockout scope `pin` (5 salah / 15 menit) dihitung per page load (modul), seperti
// `failedLogins` di mock-api — satu counter dibagi transfer, redeem custodial dan
// ganti PIN, persis scope bersama di backend.

import { ApiError } from "./client";
import type { ChangePinRequest, SetPinRequest } from "./types";

const PIN_KEY = "usdx-mock-pin";
// Seam gerbang backend USDX-698 (lihat § set di bawah) + umur sesi password-auth.
const LEGACY_SET_KEY = "usdx-mock-pin-legacy-set";
const PASSWORD_AUTH_AT_KEY = "usdx-mock-password-auth-at";
// Jendela "sesi segar" pin.yaml § set (sama dengan backend).
const FRESH_SESSION_MS = 5 * 60 * 1000;
// PIN akun bawaan di mock (argon2id di backend — di sini plaintext).
export const MOCK_PIN = "123456";
const MOCK_PIN_MAX_ATTEMPTS = 5;
const MOCK_PIN_LOCKOUT_SECONDS = 15 * 60;
const PIN_REGEX = /^[0-9]{6}$/;

interface MockPinRecord {
  // null = akun belum punya PIN.
  pin: string | null;
}

let pinMemory: MockPinRecord | null = null;
let pinFailures = 0;
let strictSetMemory = true;
let passwordAuthAtMemory: number | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRecord(): MockPinRecord | null {
  if (typeof localStorage === "undefined") return pinMemory;
  try {
    const raw = localStorage.getItem(PIN_KEY);
    return raw ? (JSON.parse(raw) as MockPinRecord) : null;
  } catch {
    return null;
  }
}

function writeRecord(record: MockPinRecord | null) {
  pinMemory = record;
  if (typeof localStorage === "undefined") return;
  if (record === null) localStorage.removeItem(PIN_KEY);
  else localStorage.setItem(PIN_KEY, JSON.stringify(record));
}

// PIN akun saat ini; null = belum punya PIN.
function currentMockPin(): string | null {
  const record = readRecord();
  return record ? record.pin : MOCK_PIN;
}

// `users.yaml § User.pinSet` untuk /auth/me + respons login/verify/reset.
export function isMockPinSet(): boolean {
  return currentMockPin() !== null;
}

// Unit test: pasang PIN akun (null = belum punya PIN).
export function seedMockPin(pin: string | null): void {
  writeRecord({ pin });
}

// Kembalikan ke bawaan (PIN `MOCK_PIN`, lockout bersih, gerbang 698 nyala, umur
// sesi dilupakan).
export function resetMockPin(): void {
  writeRecord(null);
  pinFailures = 0;
  seedMockStrictPinSet(true);
  writePasswordAuthAt(null);
}

// ── Seam gerbang first-time set (backend USDX-698, USDX-697) ────────────────
// Nyala (bawaan sejak 698 tayang di api-dev, dibalik di USDX-696) = backend
// sekarang: first-time set di akun ber-wallet custodial wajib sesi password-auth
// segar, dan REAUTH_REQUIRED membawa `details.pinSet`. Mati = backend lama:
// first-time set session-only, 401 REAUTH_REQUIRED tanpa `details` — penanda
// "usdx-mock-pin-legacy-set" di localStorage supaya Playwright bisa memerankannya
// (`seedLegacyPinSet`).
export function seedMockStrictPinSet(on: boolean): void {
  strictSetMemory = on;
  if (typeof localStorage === "undefined") return;
  if (on) localStorage.removeItem(LEGACY_SET_KEY);
  else localStorage.setItem(LEGACY_SET_KEY, "1");
}

function isStrictPinSet(): boolean {
  if (typeof localStorage === "undefined") return strictSetMemory;
  return localStorage.getItem(LEGACY_SET_KEY) === null;
}

function writePasswordAuthAt(at: number | null) {
  passwordAuthAtMemory = at;
  if (typeof localStorage === "undefined") return;
  if (at === null) localStorage.removeItem(PASSWORD_AUTH_AT_KEY);
  else localStorage.setItem(PASSWORD_AUTH_AT_KEY, String(at));
}

function readPasswordAuthAt(): number | null {
  if (typeof localStorage === "undefined") return passwordAuthAtMemory;
  const raw = localStorage.getItem(PASSWORD_AUTH_AT_KEY);
  const at = raw === null ? NaN : Number(raw);
  return Number.isFinite(at) ? at : null;
}

// Login / reset password berhasil = sesi hasil password-auth (mock-api). Sesi
// dari `loginViaStorage` Playwright tidak pernah lewat sini → basi. Login sukses
// juga membersihkan lockout `pin` (pin.yaml § verify — jalan keluar lupa-PIN).
export function markMockPasswordAuth(at: number = Date.now()): void {
  writePasswordAuthAt(at);
  pinFailures = 0;
}

// Unit test: sesi segar (password-auth barusan) atau basi.
export function seedMockSessionFresh(fresh: boolean): void {
  writePasswordAuthAt(fresh ? Date.now() : null);
}

function isSessionFresh(): boolean {
  const at = readPasswordAuthAt();
  return at !== null && Date.now() - at < FRESH_SESSION_MS;
}

// Verifikasi PIN dengan urutan backend (pin.yaml § change "Urutan pemeriksaan",
// sama untuk step-up transfer/redeem): lockout → belum punya PIN → cocokkan.
// Dipakai transfer dan redeem custodial (satu counter, seperti scope `pin`).
export function verifyMockPin(pin: string): void {
  if (pinFailures >= MOCK_PIN_MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "TOO_MANY_ATTEMPTS",
      "Terlalu banyak percobaan PIN",
      { retryAfterSeconds: MOCK_PIN_LOCKOUT_SECONDS },
      MOCK_PIN_LOCKOUT_SECONDS,
    );
  }
  const current = currentMockPin();
  if (current === null) {
    throw new ApiError(401, "PIN_NOT_SET", "Akun belum punya PIN");
  }
  if (pin !== current) {
    pinFailures += 1;
    throw new ApiError(401, "INVALID_PIN", "PIN salah");
  }
  pinFailures = 0;
}

// Jalur redeem custodial (mock-api): bentuk 6 digit dicek DULU (422 tanpa
// membakar attempt), baru diverifikasi.
export function requireAndVerifyMockPin(pin: string | undefined): void {
  if (!pin || !PIN_REGEX.test(pin)) {
    throw new ApiError(422, "VALIDATION_ERROR", "PIN harus 6 digit");
  }
  verifyMockPin(pin);
}

// ── POST /api/v2/auth/pin/set (pin.yaml § set, USDX-651) ─────────────────────
// First-time set: cukup sesi valid, `currentPin` diabaikan. Menimpa PIN yang
// SUDAH ada butuh re-auth (USDX-328): sesi password-auth segar (< 5 menit) dicek
// dulu (menimpa tanpa PIN lama = jalur lupa-PIN, USDX-696), baru `currentPin` —
// tanpa currentPin → 401 REAUTH_REQUIRED; salah → 401 INVALID_PIN (attempt
// dihitung, lockout-gated); benar → PIN diganti. Gerbang 698 nyala
// (`seedMockStrictPinSet`): first-time set di akun ber-wallet custodial tanpa sesi
// segar → REAUTH_REQUIRED `details.pinSet: false`, dan REAUTH_REQUIRED overwrite
// membawa `details.pinSet: true`.
// Sukses selalu mereset lockout `pin`. Bentuk dicek dulu → 422 tanpa membakar
// attempt.
//
// `hasCustodialWallet` diteruskan pemanggil (auth-api) — mock-custodial-wallet
// sudah mengimpor modul ini, jadi dibaca di sini akan membuat impor melingkar.
export async function mockSetPin(
  req: SetPinRequest,
  { hasCustodialWallet = false }: { hasCustodialWallet?: boolean } = {},
): Promise<void> {
  await delay(300);
  if (!PIN_REGEX.test(req.pin) || (req.currentPin !== undefined && !PIN_REGEX.test(req.currentPin))) {
    throw new ApiError(422, "VALIDATION_ERROR", "PIN harus 6 digit");
  }
  const strict = isStrictPinSet();
  const fresh = isSessionFresh();
  if (currentMockPin() === null) {
    if (strict && hasCustodialWallet && !fresh) {
      throw new ApiError(401, "REAUTH_REQUIRED", "Buat PIN butuh login ulang", { pinSet: false });
    }
  } else if (!fresh) {
    if (req.currentPin === undefined) {
      throw new ApiError(
        401,
        "REAUTH_REQUIRED",
        "Menimpa PIN butuh PIN lama atau login ulang",
        strict ? { pinSet: true } : undefined,
      );
    }
    verifyMockPin(req.currentPin);
  }
  writeRecord({ pin: req.pin });
  pinFailures = 0;
}

// ── POST /api/v2/auth/pin/change (pin.yaml § change) ─────────────────────────
// Rotasi PIN, gated PIN lama; PIN lama salah dihitung ke counter lockout yang
// SAMA dengan transfer/redeem. Urutan backend (pin.yaml § change "Urutan
// pemeriksaan"): bentuk (422 VALIDATION_ERROR) → verifikasi PIN lama (429 /
// 401 PIN_NOT_SET / 401 INVALID_PIN) → BARU newPin == currentPin (422
// PIN_UNCHANGED). PIN lama salah + PIN baru sama tetap INVALID_PIN dan membakar
// attempt.
export async function mockChangePin(req: ChangePinRequest): Promise<void> {
  await delay(300);
  if (!PIN_REGEX.test(req.currentPin) || !PIN_REGEX.test(req.newPin)) {
    throw new ApiError(422, "VALIDATION_ERROR", "PIN harus 6 digit");
  }
  verifyMockPin(req.currentPin);
  if (req.newPin === req.currentPin) {
    throw new ApiError(422, "PIN_UNCHANGED", "PIN baru harus berbeda dari PIN lama");
  }
  writeRecord({ pin: req.newPin });
}
