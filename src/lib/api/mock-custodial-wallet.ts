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

import type { CustodialWallet, CustodialWalletSummary, User } from "@/types";
import { ApiError } from "./client";
import { USDX_DECIMALS } from "@/lib/constants";

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

// Dipakai unit test untuk mengembalikan mock ke "user tanpa wallet".
export function resetMockCustodialWallet() {
  writeCustodialState(null);
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

// `users.yaml § User.custodialWallet` — ikut terbawa di /auth/me + respons
// login/verify/reset (pola `pinSet`), null untuk user tanpa wallet.
export function withCustodialWallet(user: User): User {
  return { ...user, custodialWallet: custodialSummary() };
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
