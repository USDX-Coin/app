// Penanda tujuan "login ulang" (custodial-wallet.md §5.1 "PIN di web" + "Lupa PIN
// di web"). Beberapa aksi PIN hanya boleh berjalan di sesi password-auth SEGAR
// (< 5 menit, pin.yaml § set): tombol "Login ulang" menandai niatnya di sini,
// mengakhiri sesi, dan sesudah login berhasil user mendarat di layar niat itu —
// yang mengambil penandanya sekali lalu membuangnya.
//
// sessionStorage, bukan localStorage: niat milik tab ini saja dan mati bersama
// tabnya. Isinya HANYA nama niat — tidak pernah PIN, tidak pernah URL bebas: nilai
// yang tidak dikenal diabaikan, jadi penanda tidak bisa dipakai sebagai open
// redirect. Storage yang melempar (mode privat, diblokir) = tidak ada niat.
//
// Niat pertama `create-pin` (USDX-697: first-time set di akun ber-wallet custodial
// tanpa sesi segar). Jalur lupa-PIN (USDX-696) menambah niatnya sendiri di sini.

export type ReloginIntent = "create-pin";

export const RELOGIN_INTENT_KEY = "usdx-relogin-intent";

const LANDING: Record<ReloginIntent, string> = {
  "create-pin": "/settings",
};

function isReloginIntent(value: string | null): value is ReloginIntent {
  return value !== null && Object.hasOwn(LANDING, value);
}

function readIntent(): ReloginIntent | null {
  try {
    const value = sessionStorage.getItem(RELOGIN_INTENT_KEY);
    return isReloginIntent(value) ? value : null;
  } catch {
    return null;
  }
}

export function markReloginIntent(intent: ReloginIntent): void {
  try {
    sessionStorage.setItem(RELOGIN_INTENT_KEY, intent);
  } catch {
    // Tanpa storage user tetap login ulang; hanya pendaratannya yang biasa.
  }
}

/** Halaman tujuan sesudah login, atau null. Membaca saja — tidak membuang. */
export function reloginLanding(): string | null {
  const intent = readIntent();
  return intent ? LANDING[intent] : null;
}

/** Layar tujuan mengambil niatnya: `true` sekali, lalu penandanya dibuang. */
export function takeReloginIntent(intent: ReloginIntent): boolean {
  if (readIntent() !== intent) return false;
  try {
    sessionStorage.removeItem(RELOGIN_INTENT_KEY);
  } catch {
    // Dibaca tapi tak bisa dibuang: tetap dipakai sekali ini.
  }
  return true;
}
