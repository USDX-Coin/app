import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
