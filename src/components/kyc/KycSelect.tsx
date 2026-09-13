"use client";

import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/providers/LanguageProvider";

// Satu dropdown form KYC. Sebelum USDX-586 komponen ini hidup sebagai `CddSelect`
// di dalam KycCddFields.tsx; diangkat ke berkas sendiri begitu blok identitas ikut
// butuh dropdown — supaya identitas dan CDD memakai kontrol yang sama persis,
// bukan dua salinan className yang bisa melenceng.
//
// Radix `ui/select`, BUKAN `<select>` native. Papan `07` sempat memilih native demi
// `<fieldset disabled>` dan picker OS, tapi keputusan finalnya membalikkan itu:
// "KycSelect (native <select>) → Select (07) untuk 7 dropdown ≤ 15 opsi;
// OccupationCombobox tetap Combobox (07b)". Alasannya konsistensi — dropdown bawaan
// OS tampil sebagai kotak hitam sistem di tengah form, satu-satunya kontrol di app
// yang tidak mengikuti design system.
//
// Papan itu menyebut satu syarat: "keputusan pindah ke Radix Select perlu memastikan
// disabled merambat (prop disabled dari fieldset tidak otomatis)". Diuji di browser,
// dan syarat itu ternyata TERPENUHI SENDIRI: trigger Radix adalah `<button>`, dan
// `<fieldset disabled>` menonaktifkan semua form control di dalamnya secara native.
// Terukur pada keadaan KYC PENDING — Radix memang tidak menulis atribut `disabled`
// di trigger, tapi panelnya tetap tidak terbuka saat diklik, dan `:disabled` tetap
// cocok sehingga gaya pudar ikut berlaku.
//
// Prop `disabled` tetap disediakan untuk pemakaian DI LUAR fieldset, bukan sebagai
// tambalan untuk yang di dalamnya.
// Nilai teknis enum HANYA hidup di `value`; teks yang terlihat selalu hasil `t(...)`.
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
  /**
   * Untuk pemakaian di LUAR `<fieldset disabled>`. Di dalam fieldset tidak perlu:
   * trigger Radix adalah `<button>`, jadi ia sudah dinonaktifkan native (diuji).
   */
  disabled?: boolean;
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
  disabled,
  onChange,
}: KycSelectProps) {
  const { t } = useLang();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          aria-invalid={!!error}
          aria-describedby={`${id}-error`}
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {t(labelKey(option))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldHelp id={id} error={error} />
    </Field>
  );
}
