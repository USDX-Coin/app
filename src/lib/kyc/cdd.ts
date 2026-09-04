// Nilai CDD (Customer Due Diligence) + validasi saat submit untuk form KYC retail
// (USDX-545, diperluas USDX-586).
//
// KENAPA ADA: form /kyc semula hanya mengumpulkan IDENTITAS (nama, tanggal lahir,
// KTP, alamat, foto). Partner API MEWAJIBKAN partner menyerahkan CDD lengkap untuk
// setiap nasabahnya (`partner_customer_kyc`), jadi menilai nasabah kita sendiri
// dengan data yang lebih sedikit akan membuat USDX punya dua standar CDD di dalam
// satu badan hukum — dan yang lebih lemah justru menghadap nasabah yang kita layani
// langsung.
//
// SUMBER KEBENARAN untuk seluruh nilai di bawah: `sot/api/kyc.yaml` (schema
// `Occupation`, `SourceOfFunds`, `AnnualIncomeRange`, `NetWorthRange`,
// `TransactionPurpose`, `SourceOfWealth`, `KycCddFields`). Nilai disalin PERSIS.
// Jangan mengarang, mengganti nama, atau mengubah urutan anggota di sini — kalau UI
// butuh pilihan yang tidak ada di kontrak, itu perubahan backend/kepatuhan, bukan
// perubahan front-end.
//
// NILAINYA FORMAT WIRE, BUKAN TEKS UI. Setiap anggota dirender lewat
// `t(cddOptionLabelKey(...))` supaya nasabah hanya melihat label bahasa manusia;
// `KARYAWAN_SWASTA` / `FROM_100M_TO_500M` tidak boleh muncul di layar.

// --- Kumpulan nilai (persis kyc.yaml) ---------------------------------------------------------

// 99 jenis pekerjaan Permendagri 109/2019 Formulir F-1.01 butir 31 — dipakai penuh,
// tidak disaring (keputusan ② USDX-582). Ini daftar yang sama yang dipakai Dukcapil
// mencetak kolom "Pekerjaan" di KTP-el dan Kartu Keluarga, jadi jawaban nasabah bisa
// dicocokkan langsung dengan dokumen identitas yang ia unggah — menyambung ke POJK
// 8/2023 Pasal 21 ayat (5) huruf c.
//
// Nomor di komentar adalah nomor Permendagri, BUKAN bagian dari nilai enum: nilai
// yang diawali angka ditolak generator SDK TypeScript. `CHEFF` (92) adalah ejaan
// asli di Permendagri, bukan salah ketik.
//
// Kode 48-63 seluruhnya jabatan publik dan memetakan langsung ke cakupan PEP
// domestik (Pasal 2 ayat (2) huruf b) — dipakai petugas menyilangkan jawaban
// `pepStatus`.
export const OCCUPATIONS = [
  "BELUM_TIDAK_BEKERJA",            //  1. Belum/Tidak Bekerja
  "MENGURUS_RUMAH_TANGGA",          //  2. Mengurus Rumah Tangga
  "PELAJAR_MAHASISWA",              //  3. Pelajar/Mahasiswa
  "PENSIUNAN",                      //  4. Pensiunan
  "PEGAWAI_NEGERI_SIPIL",           //  5. Pegawai Negeri Sipil (PNS)
  "TENTARA_NASIONAL_INDONESIA",     //  6. Tentara Nasional Indonesia (TNI)
  "KEPOLISIAN_RI",                  //  7. Kepolisian RI (POLRI)
  "PERDAGANGAN",                    //  8. Perdagangan
  "PETANI_PEKEBUN",                 //  9. Petani/Pekebun
  "PETERNAK",                       // 10. Peternak
  "NELAYAN_PERIKANAN",              // 11. Nelayan/Perikanan
  "INDUSTRI",                       // 12. Industri
  "KONSTRUKSI",                     // 13. Konstruksi
  "TRANSPORTASI",                   // 14. Transportasi
  "KARYAWAN_SWASTA",                // 15. Karyawan Swasta
  "KARYAWAN_BUMN",                  // 16. Karyawan BUMN
  "KARYAWAN_BUMD",                  // 17. Karyawan BUMD
  "KARYAWAN_HONORER",               // 18. Karyawan Honorer
  "BURUH_HARIAN_LEPAS",             // 19. Buruh Harian Lepas
  "BURUH_TANI_PERKEBUNAN",          // 20. Buruh Tani/Perkebunan
  "BURUH_NELAYAN_PERIKANAN",        // 21. Buruh Nelayan/Perikanan
  "BURUH_PETERNAKAN",               // 22. Buruh Peternakan
  "PEMBANTU_RUMAH_TANGGA",          // 23. Pembantu Rumah Tangga
  "TUKANG_CUKUR",                   // 24. Tukang Cukur
  "TUKANG_LISTRIK",                 // 25. Tukang Listrik
  "TUKANG_BATU",                    // 26. Tukang Batu
  "TUKANG_KAYU",                    // 27. Tukang Kayu
  "TUKANG_SOL_SEPATU",              // 28. Tukang Sol Sepatu
  "TUKANG_LAS_PANDAI_BESI",         // 29. Tukang Las/Pandai Besi
  "TUKANG_JAHIT",                   // 30. Tukang Jahit
  "TUKANG_GIGI",                    // 31. Tukang Gigi
  "PENATA_RIAS",                    // 32. Penata Rias
  "PENATA_BUSANA",                  // 33. Penata Busana
  "PENATA_RAMBUT",                  // 34. Penata Rambut
  "MEKANIK",                        // 35. Mekanik
  "SENIMAN",                        // 36. Seniman
  "TABIB",                          // 37. Tabib
  "PARAJI",                         // 38. Paraji
  "PERANCANG_BUSANA",               // 39. Perancang Busana
  "PENTERJEMAH",                    // 40. Penterjemah
  "IMAM_MASJID",                    // 41. Imam Masjid
  "PENDETA",                        // 42. Pendeta
  "PASTOR",                         // 43. Pastor
  "WARTAWAN",                       // 44. Wartawan
  "USTADZ_MUBALIGH",                // 45. Ustadz/Mubaligh
  "JURU_MASAK",                     // 46. Juru Masak
  "PROMOTOR_ACARA",                 // 47. Promotor Acara
  "ANGGOTA_DPR_RI",                 // 48. Anggota DPR-RI
  "ANGGOTA_DPD",                    // 49. Anggota DPD
  "ANGGOTA_BPK",                    // 50. Anggota BPK
  "PRESIDEN",                       // 51. Presiden
  "WAKIL_PRESIDEN",                 // 52. Wakil Presiden
  "ANGGOTA_MAHKAMAH_KONSTITUSI",    // 53. Anggota Mahkamah Konstitusi
  "ANGGOTA_KABINET_KEMENTERIAN",    // 54. Anggota Kabinet/Kementerian
  "DUTA_BESAR_KEPALA_PERWAKILAN",   // 55. Duta Besar/Kepala Perwakilan
  "GUBERNUR",                       // 56. Gubernur
  "WAKIL_GUBERNUR",                 // 57. Wakil Gubernur
  "BUPATI",                         // 58. Bupati
  "WAKIL_BUPATI",                   // 59. Wakil Bupati
  "WALIKOTA",                       // 60. Walikota
  "WAKIL_WALIKOTA",                 // 61. Wakil Walikota
  "ANGGOTA_DPRD_PROVINSI",          // 62. Anggota DPRD Provinsi
  "ANGGOTA_DPRD_KAB_KOTA",          // 63. Anggota DPRD Kab/Kota
  "DOSEN",                          // 64. Dosen
  "GURU",                           // 65. Guru
  "PILOT",                          // 66. Pilot
  "PENGACARA",                      // 67. Pengacara
  "NOTARIS",                        // 68. Notaris
  "ARSITEK",                        // 69. Arsitek
  "AKUNTAN",                        // 70. Akuntan
  "KONSULTAN",                      // 71. Konsultan
  "DOKTER",                         // 72. Dokter
  "BIDAN",                          // 73. Bidan
  "PERAWAT",                        // 74. Perawat
  "APOTEKER",                       // 75. Apoteker
  "PSIKIATER_PSIKOLOG",             // 76. Psikiater/Psikolog
  "PENYIAR_TELEVISI",               // 77. Penyiar Televisi
  "PENYIAR_RADIO",                  // 78. Penyiar Radio
  "PELAUT",                         // 79. Pelaut
  "PENELITI",                       // 80. Peneliti
  "SOPIR",                          // 81. Sopir
  "PIALANG",                        // 82. Pialang
  "PARANORMAL",                     // 83. Paranormal
  "PEDAGANG",                       // 84. Pedagang
  "PERANGKAT_DESA",                 // 85. Perangkat Desa
  "KEPALA_DESA",                    // 86. Kepala Desa
  "BIARAWATI",                      // 87. Biarawati
  "WIRASWASTA",                     // 88. Wiraswasta
  "ANGGOTA_LEMBAGA_TINGGI_LAINNYA", // 89. Anggota Lembaga Tinggi Lainnya
  "ARTIS",                          // 90. Artis
  "ATLIT",                          // 91. Atlit
  "CHEFF",                          // 92. Cheff
  "MANAJER",                        // 93. Manajer
  "TENAGA_TATA_USAHA",              // 94. Tenaga Tata Usaha
  "OPERATOR",                       // 95. Operator
  "PEKERJA_PENGOLAHAN_KERAJINAN",   // 96. Pekerja Pengolahan, Kerajinan
  "TEKNISI",                        // 97. Teknisi
  "ASISTEN_AHLI",                   // 98. Asisten Ahli
  "LAINNYA",                        // 99. Lainnya
] as const;

export const SOURCES_OF_FUNDS = [
  "SALARY",
  "BUSINESS",
  "INVESTMENT",
  "INHERITANCE",
  "OTHER",
] as const;

// Nilai dalam rupiah. Ejaan `UNDER_ / FROM_…_TO_ / OVER_` mengikuti kontrak — bentuk
// `100M_500M` yang lebih lama dibuang karena identifier tidak boleh diawali angka di
// klien yang di-generate. Jangan menghidupkan lagi anggota yang diawali angka.
export const ANNUAL_INCOME_RANGES = [
  "UNDER_100M",
  "FROM_100M_TO_500M",
  "FROM_500M_TO_1B",
  "OVER_1B",
] as const;

// Nilai harta kekayaan (net worth) — separuh kedua Pasal 25 ayat (1) huruf a angka 4.
// Batas rentangnya BUKAN angka regulasi: diambil dari ambang AML yang sudah dipakai
// sistem ini (Rp500 juta per transaksi, Rp2 miliar per hari) supaya jawaban nasabah
// bisa dibandingkan dengan plafon yang benar-benar menggerbangi transaksinya.
export const NET_WORTH_RANGES = [
  "UNDER_500M",
  "FROM_500M_TO_2B",
  "FROM_2B_TO_10B",
  "OVER_10B",
] as const;

export const TRANSACTION_PURPOSES = [
  "INVESTMENT",
  "PAYMENT",
  "REMITTANCE",
  "OTHER",
] as const;

// Sumber kekayaan — dari mana harta nasabah berasal, berbeda dari `sourceOfFunds`
// yang menjawab dari mana dana transaksi ini berasal.
//
// Dasarnya Pasal 37 ayat (1) huruf d (EDD berkala untuk PEP), BUKAN Pasal 25 —
// karena itu field-nya wajib hanya saat `pepStatus = true`, lihat `validateCdd`.
//
// kyc.yaml menandai ketujuh nilai ini BELUM PUNYA DASAR REGULASI: POJK mewajibkan
// informasinya ada tapi tidak menyebut satu pun kategori, jadi daftar ini kosakata
// kita sendiri dan sifatnya sementara. Ditulis ulang di sini supaya siapa pun yang
// membacanya tahu itu, bukan mewarisinya diam-diam sebagai "sudah sesuai POJK".
export const SOURCES_OF_WEALTH = [
  "SALARY_ACCUMULATION",
  "BUSINESS_OWNERSHIP",
  "INVESTMENT_RETURN",
  "INHERITANCE",
  "PROPERTY_SALE",
  "GRANT_OR_GIFT",
  "OTHER",
] as const;

export type Occupation = (typeof OCCUPATIONS)[number];
export type SourceOfFunds = (typeof SOURCES_OF_FUNDS)[number];
export type AnnualIncomeRange = (typeof ANNUAL_INCOME_RANGES)[number];
export type NetWorthRange = (typeof NET_WORTH_RANGES)[number];
export type TransactionPurpose = (typeof TRANSACTION_PURPOSES)[number];
export type SourceOfWealth = (typeof SOURCES_OF_WEALTH)[number];

/** Seluruh pilihan CDD, dikunci nama field form yang diisinya. */
export const CDD_OPTIONS = {
  occupation: OCCUPATIONS,
  sourceOfFunds: SOURCES_OF_FUNDS,
  annualIncomeRange: ANNUAL_INCOME_RANGES,
  netWorthRange: NET_WORTH_RANGES,
  transactionPurpose: TRANSACTION_PURPOSES,
  sourceOfWealth: SOURCES_OF_WEALTH,
} as const;

export type CddSelectField = keyof typeof CDD_OPTIONS;

/**
 * Kunci i18n untuk label satu pilihan, mis. `kyc.cdd.occupation.KARYAWAN_SWASTA`.
 * Setiap kunci yang dikembalikan fungsi ini wajib ada di KEDUA kamus (dijaga
 * tests/unit/lib/kyc-cdd.test.ts) — kunci yang hilang akan lolos lewat `t()` dan
 * menampilkan nilai teknisnya mentah-mentah di layar.
 */
export function cddOptionLabelKey(field: CddSelectField, value: string): string {
  return `kyc.cdd.${field}.${value}`;
}

// --- Bentuk form ------------------------------------------------------------------------------

/**
 * Separuh CDD dari form KYC, sebagaimana disimpan di state komponen. Semua pilihan
 * mulai kosong (`""`) supaya "belum dijawab" bisa dibedakan dari anggota mana pun —
 * sengaja tidak ada nilai default: pekerjaan yang sudah terpilih duluan adalah
 * jawaban yang tidak pernah diberikan nasabah.
 */
export interface CddFormState {
  occupation: Occupation | "";
  sourceOfFunds: SourceOfFunds | "";
  annualIncomeRange: AnnualIncomeRange | "";
  netWorthRange: NetWorthRange | "";
  transactionPurpose: TransactionPurpose | "";
  /** "Anda atau kerabat dekat memegang jabatan publik". */
  pepStatus: boolean;
  /** Ditanyakan — dan diwajibkan — hanya saat `pepStatus` true (Pasal 37 (1) d). */
  sourceOfWealth: SourceOfWealth | "";
  /** PII. Ditanyakan — dan diwajibkan — hanya saat `pepStatus` true. */
  pepRelation: string;
  /** PII. Opsional: butir g) berbunyi "tempat kerja, jika ada". */
  employerAddress: string;
  /** PII. Opsional, butir yang sama dengan `employerAddress`. */
  employerPhone: string;
  /** PII. Opsional: hanya nasabah yang benar-benar punya NPWP. */
  npwp: string;
}

export const EMPTY_CDD_FORM: CddFormState = {
  occupation: "",
  sourceOfFunds: "",
  annualIncomeRange: "",
  netWorthRange: "",
  transactionPurpose: "",
  pepStatus: false,
  sourceOfWealth: "",
  pepRelation: "",
  employerAddress: "",
  employerPhone: "",
  npwp: "",
};

export type CddErrorField =
  | "occupation"
  | "sourceOfFunds"
  | "annualIncomeRange"
  | "netWorthRange"
  | "transactionPurpose"
  | "sourceOfWealth"
  | "pepRelation";

/**
 * Kunci i18n pesan error per field. Setiap pesan yang dihasilkannya MENYEBUT NAMA
 * FIELD-nya ("Pekerjaan wajib dipilih"), tidak pernah "lengkapi form" yang generik —
 * AC USDX-545 dan USDX-586.
 */
export const CDD_ERROR_KEYS: Record<CddErrorField, string> = {
  occupation: "kyc.err.occupation",
  sourceOfFunds: "kyc.err.sourceOfFunds",
  annualIncomeRange: "kyc.err.annualIncomeRange",
  netWorthRange: "kyc.err.netWorthRange",
  transactionPurpose: "kyc.err.transactionPurpose",
  sourceOfWealth: "kyc.err.sourceOfWealth",
  pepRelation: "kyc.err.pepRelation",
};

/**
 * Field pilihan yang wajib HANYA saat nasabah menyatakan dirinya PEP. Dipisah dari
 * daftar wajib supaya aturan bersyaratnya tertulis satu kali, bukan tersebar sebagai
 * `if` di dalam loop validasi.
 */
const PEP_ONLY_SELECTS: readonly CddSelectField[] = ["sourceOfWealth"];

/**
 * Validasi blok CDD saat submit. Mengembalikan kunci i18n error per field yang
 * bermasalah; objek kosong berarti valid.
 *
 * `pepRelation` dan `sourceOfWealth` wajib JIKA DAN HANYA JIKA `pepStatus` true —
 * saat jawabannya "tidak", keduanya tidak dirender sama sekali sehingga menuntutnya
 * mustahil dipenuhi. `npwp`, `employerAddress`, dan `employerPhone` tidak pernah
 * wajib (opsional by design, "jika ada" menurut pasalnya).
 */
export function validateCdd(form: CddFormState): Partial<Record<CddErrorField, string>> {
  const errors: Partial<Record<CddErrorField, string>> = {};

  // Diturunkan dari CDD_OPTIONS, bukan daftar kedua yang ditulis tangan, supaya
  // dropdown baru tidak bisa ditambahkan ke form lalu diam-diam lolos validasi.
  for (const field of Object.keys(CDD_OPTIONS) as CddSelectField[]) {
    if (PEP_ONLY_SELECTS.includes(field) && !form.pepStatus) continue;
    if (!isCddOption(field, form[field])) errors[field] = CDD_ERROR_KEYS[field];
  }
  if (form.pepStatus && !form.pepRelation.trim()) {
    errors.pepRelation = CDD_ERROR_KEYS.pepRelation;
  }

  return errors;
}

/** Guard: apakah `value` benar-benar anggota kumpulan nilai field itu (dan bukan `""`)? */
export function isCddOption(field: CddSelectField, value: string): boolean {
  return (CDD_OPTIONS[field] as readonly string[]).includes(value);
}

/**
 * State komponen → body request. Menyempitkan tipe `| ""` setelah `validateCdd`
 * lolos, dan menormalkan field PII opsional jadi `null`, bukan `""`, supaya backend
 * menyimpan NULL (sweeper retensi meng-NULL-kan kolom ini di tempat; `""` akan
 * terlihat seperti jawaban sungguhan).
 *
 * `pepRelation` dan `sourceOfWealth` dijatuhkan ke `null` setiap kali `pepStatus`
 * false — jawaban basi yang diketik sebelum nasabah membatalkan centang tidak boleh
 * ikut terkirim.
 */
export function toCddPayload(form: CddFormState): {
  occupation: Occupation;
  sourceOfFunds: SourceOfFunds;
  annualIncomeRange: AnnualIncomeRange;
  netWorthRange: NetWorthRange;
  transactionPurpose: TransactionPurpose;
  sourceOfWealth: SourceOfWealth | null;
  employerAddress: string | null;
  employerPhone: string | null;
  pepStatus: boolean;
  pepRelation: string | null;
  npwp: string | null;
} {
  return {
    occupation: form.occupation as Occupation,
    sourceOfFunds: form.sourceOfFunds as SourceOfFunds,
    annualIncomeRange: form.annualIncomeRange as AnnualIncomeRange,
    netWorthRange: form.netWorthRange as NetWorthRange,
    transactionPurpose: form.transactionPurpose as TransactionPurpose,
    sourceOfWealth: form.pepStatus ? (form.sourceOfWealth as SourceOfWealth) || null : null,
    employerAddress: form.employerAddress.trim() || null,
    employerPhone: form.employerPhone.trim() || null,
    pepStatus: form.pepStatus,
    pepRelation: form.pepStatus ? form.pepRelation.trim() || null : null,
    npwp: form.npwp.trim() || null,
  };
}
