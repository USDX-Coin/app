"use client";

import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useLang } from "@/providers/LanguageProvider";

// Satu dropdown form KYC. Sebelum USDX-586 komponen ini hidup sebagai `CddSelect`
// di dalam KycCddFields.tsx; diangkat ke berkas sendiri begitu blok identitas ikut
// butuh dropdown — supaya identitas dan CDD memakai kontrol yang sama persis,
// bukan dua salinan className yang bisa melenceng.
//
// `<select>` bawaan, bukan Radix Select: `<fieldset disabled>` (keadaan PENDING
// form ini) merambat ke sana gratis, dan di ponsel nasabah dapat picker OS. Papan
// Figma `07` menuliskan pengecualian itu hitam di atas putih — lima dropdown app
// menyatu jadi satu Select (Radix), "untuk form KYC tetap <select> native (shadcn
// native-select) karena picker OS dan fieldset disabled". Sejak PR 2 kelasnya tidak
// lagi disalin manual — `ui/native-select.tsx` yang memegang tinggi, radius, dan
// ring fokusnya (temuan C3). Nilai teknis enum HANYA hidup di `value` option; teks
// yang terlihat selalu hasil `t(...)`.
//
// Untuk daftar panjang (99 pekerjaan Permendagri) `<select>` polos tidak lagi bisa
// dipakai manusia — itu memakai `OccupationCombobox`, bukan komponen ini.

export interface KycSelectProps {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  /** Nilai enum → kunci i18n label yang ditampilkan. */
  labelKey: (value: string) => string;
  /**
   * Teks nilai kosong, Versi 4: `Pilih` + objek yang ditanyakan — "Pilih sumber
   * dana", bukan satu "Pilih..." yang dipakai bersama tujuh dropdown lain. Kontrol
   * ini tidak bisa diketik, jadi teksnya tidak pernah hilang dan tidak pernah
   * terbaca sebagai nilai yang sudah terisi; ia label nilai kosong, bukan contoh.
   *
   * DIHILANGKAN untuk dropdown yang SELALU punya nilai (`identityType`, yang mulai
   * di `KTP`). Di sana opsi kosong bukan cuma tak pernah terlihat — ia jawaban yang
   * bisa dipilih ulang nasabah dan tidak akan pernah lolos validasi. Papan `40`
   * baris 9 menulisnya sebagai "placeholder tidak pernah tampil".
   */
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}

export function KycSelect({
  id,
  label,
  value,
  options,
  labelKey,
  placeholder,
  error,
  onChange,
}: KycSelectProps) {
  const { t } = useLang();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={`${id}-error`}
        className={value === "" ? "text-muted-text" : undefined}
      >
        {placeholder !== undefined && (
          <NativeSelectOption value="">{placeholder}</NativeSelectOption>
        )}
        {options.map((option) => (
          <NativeSelectOption key={option} value={option} className="text-foreground">
            {t(labelKey(option))}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldHelp id={id} error={error} />
    </Field>
  );
}
