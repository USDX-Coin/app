import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Locale tag per UI language. One place, so a date, a token amount and a
 * currency can never drift into different locales on the same screen.
 * `en-GB` (not `en-US`) keeps the English date in the same day-month-year order
 * as the Indonesian one — the column does not reshuffle when you flip language.
 */
type Lang = "id" | "en";
function localeOf(lang: Lang): string {
  return lang === "id" ? "id-ID" : "en-GB";
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Jumlah token untuk dibaca manusia, gaya checkout: koma desimal Indonesia dan
 * selalu dua desimal ("10,00"), tapi presisi backend tidak dipotong kalau ada
 * ("62,092307"). Figma papan 27 menulis "10,00" — `minimumFractionDigits: 2`
 * adalah alasan nol berekornya ada; `maximumFractionDigits: 6` adalah alasan
 * angka presisi tinggi tidak dibulatkan diam-diam jadi angka lain.
 *
 * Terpisah dari `formatAmount` (en-US) dengan sengaja: `formatAmount` masih
 * dipakai form mint/redeem, sidebar dan pesan validasi, dan memindahkannya
 * bukan bagian dari perubahan Riwayat ini.
 */
export function formatTokenAmount(value: string | number, lang: Lang = "id"): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(localeOf(lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(n);
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Tampilkan IDR sebagai rupiah bulat (tanpa ,00 di belakang) biar bersih dibaca —
// konsisten dengan halaman checkout. Display-only; nominal otoritatif tetap dari backend.
export function formatIDR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function parseAmount(value: string): number {
  const cleaned = value.replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Human-readable wait for rate-limit countdowns (USDX-167): ≤60s exact seconds,
// then minutes, then hours. Rounds UP (76451s → "sekitar 22 jam") so the UI never
// promises a shorter wait than the backend enforces; "sekitar"/"about" is dropped
// when the value is exact (3600s → "1 jam").
export function formatDuration(totalSeconds: number, lang: "id" | "en"): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  if (seconds <= 60) {
    return lang === "id" ? `${seconds} detik` : `${seconds}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return lang === "id" ? `${minutes} menit` : `${minutes} minutes`;
  }
  const hours = Math.ceil(seconds / 3600);
  const exact = seconds % 3600 === 0;
  if (lang === "id") return exact ? `${hours} jam` : `sekitar ${hours} jam`;
  return exact ? `${hours} hour${hours === 1 ? "" : "s"}` : `about ${hours} hours`;
}

/**
 * Tanggal panjang tanpa jam — "3 September 2026" / "3 September 2026".
 * Dulu dipaku ke `en-US`, jadi profil berbahasa Indonesia menampilkan
 * "September 3, 2026" di bawah label "Bergabung Sejak" (temuan D3).
 */
export function formatDate(dateString: string, lang: Lang = "id"): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeOf(lang), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/**
 * Tanggal + jam, gaya checkout: "3 Sep 2026, 11.13" (id) / "3 Sept 2026, 11:13" (en).
 * Titik pemisah jam pada versi Indonesia bukan pilihan kita — itu yang keluar
 * dari `id-ID`, dan itu pula yang ditulis Figma papan 27.
 *
 * **Ini satu-satunya pembentuk tanggal+jam di aplikasi.** Sebelum ini
 * `TransactionList` menyusun sendiri "Sep 05, 2026 - 01:06" dari
 * `toLocaleString("en-US")` — bulan Inggris di halaman Indonesia (D3).
 *
 * Berbeda dari `formatWibDateTime` di repo checkout: di sana jam dikunci ke
 * Asia/Jakarta dan diberi akhiran "WIB" karena dipakai untuk mencocokkan mutasi
 * bank. Riwayat menampilkan waktu lokal pembaca, tanpa akhiran, sesuai Figma.
 */
export function formatDateTime(iso: string, lang: Lang = "id"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeOf(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
