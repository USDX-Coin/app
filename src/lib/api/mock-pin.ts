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

const PIN_KEY = "usdx-mock-pin";
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

// Kembalikan ke bawaan (PIN `MOCK_PIN`, lockout bersih).
export function resetMockPin(): void {
  writeRecord(null);
  pinFailures = 0;
}

// Verifikasi PIN dengan urutan backend: belum punya PIN → lockout → cocokkan.
// Dipakai transfer dan redeem custodial (satu counter, seperti scope `pin`).
export function verifyMockPin(pin: string): void {
  const current = currentMockPin();
  if (current === null) {
    throw new ApiError(401, "PIN_NOT_SET", "Akun belum punya PIN");
  }
  if (pinFailures >= MOCK_PIN_MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "TOO_MANY_ATTEMPTS",
      "Terlalu banyak percobaan PIN",
      { retryAfterSeconds: MOCK_PIN_LOCKOUT_SECONDS },
      MOCK_PIN_LOCKOUT_SECONDS,
    );
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
