// Konfirmasi tujuan sebelum burn (USDX-661, bni-integration.md § 17.12,
// week3.md § Konfirmasi tujuan sebelum burn).
//
// Satu kelas kesalahan tidak pernah sampai ke antrean payout karena dari sisi
// sistem ia terlihat sukses sepenuhnya: nomor rekening salah ketik yang kebetulan
// valid dan milik orang lain. Inquiry menjawab "ada", transfer berhasil, order
// PAYOUT_COMPLETE — dan USDX nasabah sudah hangus. Layar pra-burn adalah satu-
// satunya titik di mana kesalahan itu masih gratis dibatalkan.
//
// Yang dijaga di sini tiga hal, semuanya murni dan bisa diuji lepas dari React:
//   1. tujuan yang ditampilkan dibaca dari RESPONSE ORDER, bukan dari form yang
//      diketik nasabah — kalau keduanya berbeda, perbedaan itu sendiri informasi
//      yang berguna;
//   2. layar hanya boleh menyebut nama itu "jawaban bank" kalau response order
//      menyatakannya `bankAccountNameVerified: true` (USDX-672). Backend punya
//      fallback yang tidak terlihat dari luar — `inquiry.accountName ??
//      bank.bankAccountName` — jadi nama di response bisa saja ketikan nasabah
//      sendiri. Melabelinya "jawaban bank" di situ memberi keyakinan palsu tepat
//      di titik yang seharusnya menangkap kesalahan, yang lebih buruk daripada
//      tidak ada layar ini sama sekali;
//   3. tombol burn tidak bisa ditekan sebelum persetujuan diberikan — di kedua
//      keadaan, terverifikasi atau tidak. Gerbangnya tidak melemah.

import type { BurnMode, RedeemStatus } from "@/types";

/** Nama pemilik yang tidak dijawab bank tetap ditampilkan — sebagai "—", bukan dilewati. */
export const ACCOUNT_NAME_FALLBACK = "—";

export interface OrderDestination {
  bankName: string;
  accountNumber: string;
  /** Siap tampil: nama dari response order, atau `ACCOUNT_NAME_FALLBACK`. */
  accountName: string;
  /** False kalau API tidak mengirim nama — layar tetap meminta konfirmasi. */
  accountNameKnown: boolean;
  /**
   * Apakah layar BOLEH menyebut nama itu jawaban bank atas nomor rekening ini
   * (USDX-672). True hanya kalau response order menyatakannya secara eksplisit dan
   * namanya memang ada. `false` DAN `undefined` sama-sama menghasilkan false:
   * payload yang belum membawa field ini tidak membuktikan apa pun, dan klaim yang
   * tidak bisa dibuktikan tidak dipasang. Persetujuan tetap diminta di kedua
   * keadaan — yang berbeda cuma apa yang layar berani katakan soal asal namanya.
   */
  accountNameVerified: boolean;
}

/**
 * Tujuan payout apa adanya dari response order: bank · nomor rekening · nama
 * pemilik, plus apakah nama itu boleh disebut jawaban bank. Tidak pernah membaca
 * state form — itu ketikan nasabah, dan mengonfirmasi ketikan sendiri bukan
 * verifikasi apa pun.
 */
export function orderDestination(order: {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankAccountNameVerified?: boolean | null;
}): OrderDestination {
  const name = order.bankAccountName?.trim() ?? "";
  return {
    bankName: order.bankName?.trim() || ACCOUNT_NAME_FALLBACK,
    accountNumber: order.bankAccountNumber?.trim() || ACCOUNT_NAME_FALLBACK,
    accountName: name || ACCOUNT_NAME_FALLBACK,
    accountNameKnown: name !== "",
    // `=== true` dengan sengaja, bukan truthiness: `undefined` (backend belum
    // membawa field ini) harus jatuh ke false, sama seperti `false` eksplisit.
    accountNameVerified: name !== "" && order.bankAccountNameVerified === true,
  };
}

/**
 * Apakah layar masih harus meminta persetujuan tujuan sebelum burn.
 *
 * Hanya di `AWAITING_BURN` dan hanya di jalur SELF_SIGN: di jalur CUSTODIAL tidak
 * ada tanda tangan nasabah sama sekali (PIN saat create adalah persetujuannya, dan
 * sistem yang membakar), jadi tidak ada tombol burn untuk digerbangi. Begitu burn
 * ter-broadcast (`burnInFlight`) persetujuannya sudah terjadi — bloknya turun dan
 * layar berganti ke "memproses burn".
 */
export function destinationConfirmRequired(
  order: { status: RedeemStatus; burnMode?: BurnMode },
  burnInFlight: boolean,
): boolean {
  if (order.status !== "AWAITING_BURN") return false;
  if (order.burnMode === "CUSTODIAL") return false;
  return !burnInFlight;
}

/**
 * Gerbang tombol burn. Persetujuan tujuan adalah syarat KETIGA, di samping
 * precondition wallet (jaringan/saldo/gas) dan wallet yang terikat ke order —
 * langkah tersendiri, bukan tombol burn yang sama.
 */
export function burnDisabled(gate: {
  canBurn: boolean;
  walletMatches: boolean;
  /** Persetujuan sudah diberikan untuk order INI (atau tidak diminta lagi). */
  destinationConfirmed: boolean;
}): boolean {
  return !gate.canBurn || !gate.walletMatches || !gate.destinationConfirmed;
}
