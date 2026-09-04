/**
 * Preset spring untuk komponen Animate UI (Radix + `motion`).
 *
 * Nilai bawaan Animate UI (`stiffness 150, damping 25`) terasa lambat dan
 * sedikit memantul. Ketiga preset di bawah diset mendekati critically damped
 * (ζ ≥ 0,88) — tidak ada yang memantul, karena ini aplikasi yang memegang uang
 * orang: gerakan boleh terasa hidup, tapi tidak boleh terasa main-main.
 *
 * Dipakai lewat prop `transition` yang sudah disediakan tiap primitive.
 * Jangan menulis angka spring langsung di komponen — impor dari sini, supaya
 * satu perubahan berlaku di semua tempat.
 *
 * Untuk animasi berbasis waktu (bukan spring), pakai token durasi dan easing
 * di `globals.css`: `duration-(--dur-3) ease-enter`.
 */

/** Dialog, sheet, kartu status — permukaan besar. ζ ≈ 0,95 · ±350 ms */
export const springSurface = {
  type: "spring",
  stiffness: 320,
  damping: 34,
} as const;

/** Highlight tab, ikon salin↔ceklis, dropdown. ζ ≈ 0,88 · ±220 ms */
export const springSnappy = {
  type: "spring",
  stiffness: 520,
  damping: 40,
} as const;

/** Perubahan tinggi (AutoHeight). Bounce 0 — tinggi yang memantul terbaca rusak. */
export const springHeight = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  bounce: 0,
} as const;
