// ── Mock 2FA TOTP (two-factor.yaml — backend USDX-312/313, web USDX-714) ─────
// Memerankan backend 2FA supaya alur web berjalan offline: enroll (enable →
// verify), matikan (password ATAU kode TOTP), regenerate backup code, login
// langkah 2 di atas challenge, dan pemulihan via email.
//
// Kode yang diterima mock (TOTP asli butuh secret + jam; tidak berguna di test)
// ada di mock-two-factor-fixtures.ts — `MOCK_TOTP_CODE`, `MOCK_BACKUP_CODES`,
// `MOCK_RECOVERY_OTP` (diekspor ulang di sini untuk unit test).
//
// 2FA milik AKUN (`user.twoFactorEnabled`, users.yaml § User), seperti PIN di
// mock-pin.ts. State di localStorage ("usdx-mock-two-factor") supaya bertahan
// melintasi `page.goto` Playwright; ABSEN = 2FA mati (bawaan semua akun demo).
// Challenge login langkah 1 (cookie `two_factor` di backend, TTL 10 menit, sekali
// pakai) juga di localStorage ("usdx-mock-2fa-challenge") berisi email akun yang
// menunggu — mock-api yang menyelesaikan loginnya.
//
// Lockout scope `2fa-verify` (5 salah / 15 menit) dihitung per page load (modul),
// seperti `pinFailures` di mock-pin — satu counter dibagi verify, disable,
// verify-login, sama dengan backend. Pemulihan email punya scope sendiri.
//
// Pengecekan password dilakukan pemanggil (two-factor-api meneruskan
// `passwordOk` dari mock-api, pemilik akun) — pola `hasCustodialWallet` di
// mockSetPin, supaya modul ini tidak mengimpor mock-api (impor melingkar).

import { ApiError } from "./client";
import {
  MOCK_BACKUP_CODES,
  MOCK_RECOVERY_OTP,
  MOCK_TOTP_CODE,
  MOCK_TOTP_SECRET,
} from "./mock-two-factor-fixtures";
import type { TwoFactorEnrollment } from "@/types";
import type {
  DisableTwoFactorRequest,
  TwoFactorCodeRequest,
  TwoFactorPasswordRequest,
  TwoFactorRecoveryRequest,
} from "./types";

export { MOCK_BACKUP_CODES, MOCK_RECOVERY_OTP, MOCK_TOTP_CODE };

const STATE_KEY = "usdx-mock-two-factor";
const CHALLENGE_KEY = "usdx-mock-2fa-challenge";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const RECOVERY_RESEND_SECONDS = 60;
const TOTP_PATTERN = /^[0-9]{6}$/;

interface MockTwoFactorState {
  enabled: boolean;
  // Enroll dimulai (enable) tapi belum diverifikasi.
  pending: boolean;
  backupCodes: string[];
}

interface MockChallenge {
  email: string;
  expiresAt: number;
}

let stateMemory: MockTwoFactorState | null = null;
let challengeMemory: MockChallenge | null = null;
let verifyFailures = 0;
let recoveryFailures = 0;
let recoverySentAt: number | null = null;
let regenerations = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson<T>(key: string, memory: T | null): T | null {
  if (typeof localStorage === "undefined") return memory;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T | null) {
  if (typeof localStorage === "undefined") return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

function readState(): MockTwoFactorState | null {
  return readJson(STATE_KEY, stateMemory);
}

function writeState(state: MockTwoFactorState | null) {
  stateMemory = state;
  writeJson(STATE_KEY, state);
}

function readChallenge(): MockChallenge | null {
  return readJson(CHALLENGE_KEY, challengeMemory);
}

function writeChallenge(challenge: MockChallenge | null) {
  challengeMemory = challenge;
  writeJson(CHALLENGE_KEY, challenge);
}

function lockoutError(): ApiError {
  return new ApiError(
    429,
    "TOO_MANY_ATTEMPTS",
    "Terlalu banyak percobaan verifikasi 2FA. Coba lagi nanti.",
    { retryAfterSeconds: LOCKOUT_SECONDS },
    LOCKOUT_SECONDS,
  );
}

function assertNotLocked() {
  if (verifyFailures >= MAX_ATTEMPTS) throw lockoutError();
}

function wrongCode(message = "Kode 2FA tidak valid."): ApiError {
  return new ApiError(401, "INVALID_TWO_FACTOR_CODE", message);
}

function wrongPassword(): ApiError {
  verifyFailures += 1;
  return new ApiError(401, "INVALID_CREDENTIALS", "Password salah.");
}

function notEnabled(): ApiError {
  return new ApiError(400, "TWO_FACTOR_NOT_ENABLED", "2FA belum di-setup di akun Anda.");
}

function challengeExpired(): ApiError {
  return new ApiError(
    401,
    "TWO_FACTOR_CHALLENGE_EXPIRED",
    "Sesi verifikasi 2FA tidak valid atau kedaluwarsa. Silakan login ulang.",
  );
}

function requireEnrollment(): MockTwoFactorState {
  const state = readState();
  if (!state || (!state.enabled && !state.pending)) throw notEnabled();
  return state;
}

function assertTotp(code: string) {
  if (code.trim() !== MOCK_TOTP_CODE) {
    verifyFailures += 1;
    throw wrongCode();
  }
}

// `users.yaml § User.twoFactorEnabled` untuk /auth/me + respons login.
export function isMockTwoFactorEnabled(): boolean {
  return readState()?.enabled === true;
}

// Unit/Playwright: 2FA aktif (dengan `MOCK_BACKUP_CODES`) atau mati.
export function seedMockTwoFactor(enabled: boolean): void {
  writeState(enabled ? { enabled: true, pending: false, backupCodes: [...MOCK_BACKUP_CODES] } : null);
}

// Unit/Playwright: challenge login langkah 1 sudah lewat 10 menit.
export function seedMockTwoFactorChallengeExpired(): void {
  const challenge = readChallenge();
  if (challenge) writeChallenge({ ...challenge, expiresAt: 0 });
}

export function resetMockTwoFactor(): void {
  writeState(null);
  writeChallenge(null);
  verifyFailures = 0;
  recoveryFailures = 0;
  recoverySentAt = null;
  regenerations = 0;
}

// ── Login langkah 1 (dipanggil mockLogin untuk akun ber-2FA) ─────────────────
export function startMockTwoFactorChallenge(email: string): void {
  writeChallenge({ email, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

function liveChallenge(): MockChallenge {
  const challenge = readChallenge();
  if (!challenge || challenge.expiresAt <= Date.now()) throw challengeExpired();
  return challenge;
}

// ── POST /api/v2/auth/2fa/verify-login ───────────────────────────────────────
// TOTP 6 digit atau backup code (sekali pakai). Benar → challenge habis, email
// akun yang menunggu dikembalikan (mock-api menerbitkan sesinya).
export async function takeMockTwoFactorLogin(code: string): Promise<string> {
  await delay(300);
  const challenge = liveChallenge();
  assertNotLocked();
  const state = readState();
  const trimmed = code.trim();
  let valid = false;
  if (state?.enabled) {
    if (TOTP_PATTERN.test(trimmed)) {
      valid = trimmed === MOCK_TOTP_CODE;
    } else if (state.backupCodes.includes(trimmed)) {
      writeState({ ...state, backupCodes: state.backupCodes.filter((c) => c !== trimmed) });
      valid = true;
    }
  }
  if (!valid) {
    verifyFailures += 1;
    throw wrongCode();
  }
  verifyFailures = 0;
  writeChallenge(null);
  return challenge.email;
}

// ── POST /api/v2/auth/2fa/enable ─────────────────────────────────────────────
export async function mockEnableTwoFactor(
  _req: TwoFactorPasswordRequest,
  { passwordOk }: { passwordOk: boolean },
): Promise<TwoFactorEnrollment> {
  await delay(300);
  assertNotLocked();
  if (!passwordOk) throw wrongPassword();
  verifyFailures = 0;
  const current = readState();
  writeState({
    enabled: current?.enabled ?? false,
    pending: true,
    backupCodes: [...MOCK_BACKUP_CODES],
  });
  return {
    totpUri: `otpauth://totp/USDX:demo%40usdx.com?secret=${MOCK_TOTP_SECRET}&issuer=USDX&digits=6&period=30`,
    backupCodes: [...MOCK_BACKUP_CODES],
  };
}

// ── POST /api/v2/auth/2fa/verify ─────────────────────────────────────────────
export async function mockVerifyTwoFactor(req: TwoFactorCodeRequest): Promise<void> {
  await delay(300);
  const state = requireEnrollment();
  assertNotLocked();
  assertTotp(req.code);
  verifyFailures = 0;
  writeState({ ...state, enabled: true, pending: false });
}

// ── POST /api/v2/auth/2fa/disable ────────────────────────────────────────────
// Either/or: password ATAU kode TOTP (bukan backup code — two-factor.service).
export async function mockDisableTwoFactor(
  req: DisableTwoFactorRequest,
  { passwordOk }: { passwordOk: boolean },
): Promise<void> {
  await delay(300);
  requireEnrollment();
  assertNotLocked();
  if ("code" in req) assertTotp(req.code);
  else if (!passwordOk) throw wrongPassword();
  verifyFailures = 0;
  writeState(null);
}

// ── POST /api/v2/auth/2fa/backup-codes/regenerate ────────────────────────────
// Set lama mati seluruhnya; set baru berbeda dari yang bawaan.
export async function mockRegenerateBackupCodes(
  _req: TwoFactorPasswordRequest,
  { passwordOk }: { passwordOk: boolean },
): Promise<{ backupCodes: string[] }> {
  await delay(300);
  const state = readState();
  if (!state?.enabled) throw notEnabled();
  assertNotLocked();
  if (!passwordOk) throw wrongPassword();
  verifyFailures = 0;
  regenerations += 1;
  const backupCodes = MOCK_BACKUP_CODES.map((c) => `${c.slice(0, 6)}${regenerations}${c.slice(7)}`);
  writeState({ ...state, backupCodes });
  return { backupCodes };
}

// ── POST /api/v2/auth/2fa/recovery/email ─────────────────────────────────────
// Di antara login langkah 1 dan sesi (challenge). Tanpa `code` = kirim OTP
// (cooldown kirim ulang); dengan `code` = OTP benar → 2FA mati + challenge habis
// (klien login ulang dengan email + password).
export async function mockTwoFactorRecovery(req: TwoFactorRecoveryRequest): Promise<void> {
  await delay(300);
  liveChallenge();
  if (recoveryFailures >= MAX_ATTEMPTS) throw lockoutError();
  const code = req.code?.trim();
  if (!code) {
    const elapsed = recoverySentAt === null ? Infinity : (Date.now() - recoverySentAt) / 1000;
    if (elapsed < RECOVERY_RESEND_SECONDS) {
      const retryAfterSeconds = Math.ceil(RECOVERY_RESEND_SECONDS - elapsed);
      throw new ApiError(
        429,
        "TOO_MANY_REQUESTS",
        "Mohon tunggu sebelum meminta kirim ulang kode.",
        { retryAfterSeconds },
        retryAfterSeconds,
      );
    }
    recoverySentAt = Date.now();
    return;
  }
  if (recoverySentAt === null || code !== MOCK_RECOVERY_OTP) {
    recoveryFailures += 1;
    throw wrongCode("Kode pemulihan tidak valid atau kedaluwarsa.");
  }
  recoveryFailures = 0;
  writeState(null);
  writeChallenge(null);
}
