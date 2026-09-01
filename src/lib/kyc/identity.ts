// Nilai + validasi blok IDENTITAS form KYC retail (USDX-586).
//
// Berdampingan dengan `cdd.ts`, tidak digabung ke dalamnya: `KycCddFields` adalah
// satu schema yang dipakai DUA endpoint (`POST /api/v2/kyc` dan
// `PATCH /api/v2/kyc/cdd`), sedangkan field di berkas ini hanya hidup di bagian
// identitas `SubmitKycRequest`. kyc.yaml menyebut batas itu eksplisit: nasabah yang
// sudah VERIFIED TIDAK punya jalur untuk mengisi lima field identitas baru lewat
// `PATCH /api/v2/kyc/cdd`, dan itu lubang yang sudah diketahui (jalurnya = pengkinian
// data berkala Pasal 51, keputusan PM). Menaruh keduanya dalam satu modul akan
// mengundang seseorang mengirim field identitas lewat endpoint CDD.
//
// SUMBER KEBENARAN: `sot/api/kyc.yaml` — schema `IdentityType`, `Gender`,
// `MaritalStatus`, dan bagian identitas `SubmitKycRequest`. Nilai disalin PERSIS.

// Dokumen identitas yang ditawarkan form ini. `DRIVER_LICENSE` ADA di enum kontrak
// tapi sengaja TIDAK ditawarkan: kyc.yaml menyatakan SIM tidak disebut POJK 8/2023
// Pasal 26 ayat (2) sebagai dokumen identitas yang sah untuk CDD, nilainya hanya
// dipertahankan karena sudah ada di tipe Postgres, dan "jangan tawarkan sebagai
// pilihan di form baru". Jadi daftar ini SENGAJA lebih pendek dari enum kontrak.
export const IDENTITY_TYPES = ["KTP", "PASSPORT"] as const;

// Kosakata KTP (`LAKI-LAKI` / `PEREMPUAN`), bukan `MALE`/`FEMALE` — field ini dibaca
// petugas dari KTP yang diunggah nasabah, dan jawaban yang memakai kata yang sama
// dengan dokumennya bisa dicocokkan tanpa menerjemahkan.
export const GENDERS = ["LAKI_LAKI", "PEREMPUAN"] as const;

// Empat status perkawinan yang tercetak di KTP-el, alasan sama dengan `GENDERS`.
export const MARITAL_STATUSES = ["BELUM_KAWIN", "KAWIN", "CERAI_HIDUP", "CERAI_MATI"] as const;

export type IdentityType = (typeof IDENTITY_TYPES)[number];
export type Gender = (typeof GENDERS)[number];
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/** Pilihan identitas yang dirender sebagai dropdown, dikunci nama field form. */
export const IDENTITY_OPTIONS = {
  identityType: IDENTITY_TYPES,
  gender: GENDERS,
  maritalStatus: MARITAL_STATUSES,
} as const;

export type IdentitySelectField = keyof typeof IDENTITY_OPTIONS;

/**
 * Kunci i18n label satu pilihan, mis. `kyc.identity.gender.LAKI_LAKI`. Setiap kunci
 * wajib ada di KEDUA kamus (dijaga tests/unit/lib/kyc-identity.test.ts).
 */
export function identityOptionLabelKey(field: IdentitySelectField, value: string): string {
  return `kyc.identity.${field}.${value}`;
}

// --- Bentuk form ------------------------------------------------------------------------------

/**
 * Separuh identitas dari form KYC. `country` tidak ada di sini: nilainya tetap `ID`
 * (kyc.yaml: "Phase 2 awal hanya `ID`") dan ditampilkan read-only, jadi ia bukan
 * state yang bisa diubah nasabah.
 */
export interface IdentityFormState {
  firstName: string;
  lastName: string;
  /** Opsional — butir a) berbunyi "termasuk nama alias, jika ada". */
  aliasName: string;
  dob: string;
  birthPlace: string;
  identityType: IdentityType;
  identityNumber: string;
  /** Kode ISO 3166-1 alpha-2, huruf besar. BUKAN duplikat `country`. */
  nationality: string;
  gender: Gender | "";
  maritalStatus: MaritalStatus | "";
  /** PII, wajib — butir j) tidak punya kualifikasi "jika ada". */
  mothersMaidenName: string;
  addressLine1: string;
  /** Opsional — "alamat tempat tinggal lain, jika ada". */
  addressLine2: string;
}

export const EMPTY_IDENTITY_FORM: IdentityFormState = {
  firstName: "",
  lastName: "",
  aliasName: "",
  dob: "",
  birthPlace: "",
  // Dua field ini PUNYA nilai awal, beda dari dropdown CDD yang sengaja mulai kosong.
  // Alasannya: keduanya bukan jawaban due diligence, melainkan konteks dokumen —
  // kontraknya sendiri menetapkan `default: "ID"` untuk `nationality`, dan `KTP`
  // adalah satu-satunya jenis identitas yang bisa dipilih form ini sebelum USDX-586.
  // Nasabah WNA mengganti keduanya; nasabah WNI tidak diminta menjawab yang sudah
  // jelas.
  identityType: "KTP",
  identityNumber: "",
  nationality: "ID",
  gender: "",
  maritalStatus: "",
  mothersMaidenName: "",
  addressLine1: "",
  addressLine2: "",
};

export type IdentityErrorField =
  | "firstName"
  | "lastName"
  | "dob"
  | "birthPlace"
  | "identityNumber"
  | "nationality"
  | "gender"
  | "maritalStatus"
  | "mothersMaidenName"
  | "addressLine1";

/**
 * Kunci i18n pesan error per field. Setiap pesan MENYEBUT NAMA FIELD-nya, tidak
 * pernah "lengkapi form" yang generik — AC USDX-586.
 *
 * `identityNumber` tidak ada di sini karena pesannya bergantung `identityType`:
 * lihat `identityNumberErrorKey`.
 */
export const IDENTITY_ERROR_KEYS: Record<Exclude<IdentityErrorField, "identityNumber">, string> = {
  firstName: "kyc.err.firstName",
  lastName: "kyc.err.lastName",
  dob: "kyc.err.dob",
  birthPlace: "kyc.err.birthPlace",
  nationality: "kyc.err.nationality",
  gender: "kyc.err.gender",
  maritalStatus: "kyc.err.maritalStatus",
  mothersMaidenName: "kyc.err.mothersMaidenName",
  addressLine1: "kyc.err.address",
};

const NIK_PATTERN = /^\d{16}$/;
const NATIONALITY_PATTERN = /^[A-Z]{2}$/;

/**
 * Apakah nomor identitas sah menurut jenis dokumennya?
 *
 * - `KTP` — 16 digit numerik, aturan yang sudah berlaku sejak USDX-152.
 * - `PASSPORT` — HANYA wajib terisi. Sengaja tidak ada aturan panjang atau pola:
 *   kyc.yaml menulis "paspor mengikuti format penerbitnya (alfanumerik). Backend
 *   validate format sesuai `identityType`", jadi format definitifnya milik backend.
 *   Menebak batas panjang di sini berarti menolak paspor sah dari negara yang
 *   tebakannya meleset — kesalahan yang sama dengan validator NPWP yang menolak
 *   nomor bertitik.
 */
export function isIdentityNumberValid(identityType: IdentityType, value: string): boolean {
  if (identityType === "KTP") return NIK_PATTERN.test(value);
  return value.trim() !== "";
}

/** Kunci pesan error nomor identitas — berbeda per jenis dokumen. */
export function identityNumberErrorKey(identityType: IdentityType): string {
  return identityType === "KTP" ? "kyc.err.nik" : "kyc.err.passportNumber";
}

/** Kunci label + placeholder nomor identitas — ikut berubah bersama jenis dokumen. */
export function identityNumberLabelKey(identityType: IdentityType): string {
  return identityType === "KTP" ? "kyc.identityNumber" : "kyc.identityNumberPassport";
}

export function identityNumberPlaceholderKey(identityType: IdentityType): string {
  return identityType === "KTP" ? "kyc.identityNumberPh" : "kyc.identityNumberPassportPh";
}

/**
 * Kunci label foto dokumen. Object key-nya tetap memakai prefix `ktp/`
 * (`docKind` di `storage.yaml` hanya mengenal `ktp` | `selfie`, dan mengubahnya
 * adalah perubahan kontrak storage, bukan bagian USDX-586) — yang berubah hanya
 * teks yang dibaca nasabah, supaya pemegang paspor tidak diminta "Foto KTP".
 */
export function identityDocLabelKey(identityType: IdentityType): string {
  return identityType === "KTP" ? "kyc.ktpPhoto" : "kyc.passportPhoto";
}

export function selfieDocLabelKey(identityType: IdentityType): string {
  return identityType === "KTP" ? "kyc.selfiePhoto" : "kyc.selfiePhotoPassport";
}

/** Guard: apakah `value` anggota kumpulan nilai field itu (dan bukan `""`)? */
export function isIdentityOption(field: IdentitySelectField, value: string): boolean {
  return (IDENTITY_OPTIONS[field] as readonly string[]).includes(value);
}

/**
 * Validasi blok identitas saat submit. Mengembalikan kunci i18n error per field yang
 * bermasalah; objek kosong berarti valid.
 *
 * `aliasName` dan `addressLine2` TIDAK pernah divalidasi: pasalnya sendiri menutup
 * keduanya dengan "jika ada", jadi kosong adalah jawaban lengkap — bukan pengajuan
 * yang kurang.
 */
export function validateIdentity(
  form: IdentityFormState,
): Partial<Record<IdentityErrorField, string>> {
  const errors: Partial<Record<IdentityErrorField, string>> = {};

  if (!form.firstName.trim()) errors.firstName = IDENTITY_ERROR_KEYS.firstName;
  if (!form.lastName.trim()) errors.lastName = IDENTITY_ERROR_KEYS.lastName;
  if (!form.dob) errors.dob = IDENTITY_ERROR_KEYS.dob;
  if (!form.birthPlace.trim()) errors.birthPlace = IDENTITY_ERROR_KEYS.birthPlace;
  if (!isIdentityNumberValid(form.identityType, form.identityNumber)) {
    errors.identityNumber = identityNumberErrorKey(form.identityType);
  }
  if (!NATIONALITY_PATTERN.test(form.nationality)) {
    errors.nationality = IDENTITY_ERROR_KEYS.nationality;
  }
  if (!isIdentityOption("gender", form.gender)) errors.gender = IDENTITY_ERROR_KEYS.gender;
  if (!isIdentityOption("maritalStatus", form.maritalStatus)) {
    errors.maritalStatus = IDENTITY_ERROR_KEYS.maritalStatus;
  }
  if (!form.mothersMaidenName.trim()) {
    errors.mothersMaidenName = IDENTITY_ERROR_KEYS.mothersMaidenName;
  }
  if (!form.addressLine1.trim()) errors.addressLine1 = IDENTITY_ERROR_KEYS.addressLine1;

  return errors;
}

/**
 * State komponen → separuh identitas body request. Field opsional dinormalkan jadi
 * `null`, bukan `""`, supaya backend menyimpan NULL — `""` akan terlihat seperti
 * "nasabah menyatakan aliasnya string kosong", dan sweeper retensi meng-NULL-kan
 * kolom PII di tempat.
 */
export function toIdentityPayload(form: IdentityFormState): {
  firstName: string;
  lastName: string;
  aliasName: string | null;
  dob: string;
  birthPlace: string;
  identityType: IdentityType;
  identityNumber: string;
  nationality: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  mothersMaidenName: string;
  addressLine1: string;
  addressLine2: string | null;
} {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    aliasName: form.aliasName.trim() || null,
    dob: form.dob,
    birthPlace: form.birthPlace.trim(),
    identityType: form.identityType,
    identityNumber: form.identityNumber.trim(),
    nationality: form.nationality,
    gender: form.gender as Gender,
    maritalStatus: form.maritalStatus as MaritalStatus,
    mothersMaidenName: form.mothersMaidenName.trim(),
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2.trim() || null,
  };
}
