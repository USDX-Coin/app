"use client";

import { useState } from "react";
import { useCommandState } from "cmdk";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import { OCCUPATIONS, cddOptionLabelKey, type CddFormState } from "@/lib/kyc/cdd";

// Pemilih pekerjaan dengan pencarian (USDX-586).
//
// KENAPA BUKAN `<select>` seperti dropdown CDD lain: daftarnya 99 jenis pekerjaan
// Permendagri, dan 99 baris di dropdown polos tidak bisa dipakai manusia — nasabah
// harus menggulir mencari "Karyawan Swasta" di antara 98 baris lain. Ini SATU-SATUNYA
// field CDD yang mendapat kontrol berbeda; sisanya (4-7 pilihan) tetap `<select>`
// bawaan lewat `KycSelect`.
//
// Pola Combobox shadcn: Popover + Command (cmdk), digenerate lewat `shadcn add
// popover command`. Penyaringan dikerjakan cmdk terhadap teks yang TERLIHAT, jadi
// nasabah mengetik "swasta" dan menemukan "Karyawan Swasta" — nilai enum
// `KARYAWAN_SWASTA` tidak pernah muncul di layar maupun ikut disaring.
//
// Yang tersimpan tetap nilai enum, bukan teks bebas: `onChange` hanya bisa dipanggil
// dari `CommandItem` yang dibangun dari `OCCUPATIONS`, dan kotak pencarian tidak
// pernah jadi jawaban. Nasabah yang pekerjaannya tidak ada di daftar memilih
// `LAINNYA` (kode 99) — persis seperti di formulir Dukcapil.
//
// TRIGGER = SELECT, BUKAN TOMBOL (Figma `07b` + `40` blok B4)
// -----------------------------------------------------------
// Secara DOM ini `Button variant="outline"`, tapi yang dilihat nasabah harus satu
// kontrol yang sama dengan tujuh `KycSelect` di sekelilingnya. Tiga kelas outline
// meleset dari `Input`/`NativeSelect` dan ketiganya ditimpa di bawah:
//   1. `border-border` (#dddddd) vs `border-input` (#e5e5e5) — di tema terang
//      garisnya lebih gelap daripada dropdown tetangganya, satu baris di bawahnya.
//   2. tidak ada `dark:bg-input/30` — di tema gelap isinya rata dengan kartu,
//      sementara dropdown lain sedikit lebih terang.
//   3. hover `bg-accent`, sedangkan papan `07` menulis hover = `border-foreground/25`
//      (garis, bukan bidang).
// Yang keempat dulu paling parah dan sekarang sudah pindah ke tempat yang benar:
// varian `outline` tidak punya aturan `aria-invalid` sama sekali, jadi pekerjaan yang
// belum dipilih hanya memerah pesannya — kotaknya tetap netral, satu-satunya field
// wajib di form ini yang begitu. Aturannya kini hidup di `ui/button.tsx`.

export interface OccupationComboboxProps {
  value: CddFormState["occupation"];
  error?: string;
  onChange: (value: CddFormState["occupation"]) => void;
}

/**
 * "2 dari 99 pekerjaan" (Figma `40` B4). Bukan hiasan: 99 baris di balik kotak cari
 * tidak punya dasar akhir yang terlihat, jadi nasabah yang mengetik "swasta" tidak
 * tahu apakah dua hasil itu SEMUA yang cocok atau hanya dua yang pertama.
 *
 * Angkanya diambil dari cmdk sendiri (`state.filtered.count`), bukan dihitung ulang
 * di sini — cmdk menyaring dengan pemeringkatan fuzzy-nya sendiri, dan menyalin
 * logika itu berarti menampilkan angka yang lambat laun berbeda dari daftar yang
 * benar-benar dirender. Wajib dirender DI DALAM `<Command>`.
 */
function OccupationCount({ total }: { total: number }) {
  const { t } = useLang();
  const count = useCommandState((state) => state.filtered.count);

  if (count === 0) return null;

  return (
    <div className="border-t border-border px-3 py-2 text-xs text-muted-text">
      {t("kyc.cdd.occupationCount", { n: String(count), total: String(total) })}
    </div>
  );
}

export function OccupationCombobox({ value, error, onChange }: OccupationComboboxProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const selectedLabel = value ? t(cddOptionLabelKey("occupation", value)) : "";

  return (
    <Field>
      <FieldLabel htmlFor="occupation">{t("kyc.cdd.occupation")}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="occupation"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!!error}
            aria-describedby="occupation-error"
            data-testid="occupation-trigger"
            className={cn(
              "h-11 w-full justify-between px-3 font-normal",
              // Sengaja tidak memakai `disabled` sendiri: tombol ini berada di dalam
              // <fieldset disabled> milik form, yang sudah mematikannya secara native.
              "border-input dark:bg-input/30",
              "pointer-fine:hover:border-foreground/25 pointer-fine:hover:bg-card dark:pointer-fine:hover:bg-input/30",
              "focus-visible:border-focus-ring",
              // Keadaan error TIDAK ditulis di sini lagi — varian `outline` sudah
              // punya aturan `aria-invalid`-nya sendiri sejak PR ini.
              !value && "text-muted-text",
            )}
          >
            <span className="truncate">{selectedLabel || t("kyc.cdd.occupationPh")}</span>
            {/* Satu chevron yang berputar, bukan `ChevronsUpDown`: papan `07` memberi
                Select SATU panah ke bawah yang berputar 180° saat terbuka (dur-1), dan
                panah ganda di sini membuat pekerjaan jadi satu-satunya kontrol di form
                yang ikonnya berbeda dari tujuh dropdown lain. */}
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-text transition-transform duration-(--dur-1) ease-(--ease-standard)",
                open && "rotate-180",
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          // `--radix-popover-trigger-width`: panel selebar tombolnya, supaya label
          // panjang seperti "Anggota Lembaga Tinggi Lainnya" tidak terpotong.
          //
          // Tidak ada lagi `max-w-none`/`max-h-none` di sini: `ui/popover.tsx` sudah
          // mengganti `max-w-[360px]` yang dulu memotong panel jadi 360 px (di bawah
          // trigger 576 px) dengan pagar viewport, dan tingginya sekarang memakai
          // `--radix-popover-content-available-height` yang sama dengan yang dipakai
          // daftar di bawah. Karena keduanya berdasar angka yang sama, isi panel
          // TIDAK PERNAH lebih tinggi daripada batas panel — pengguliran milik
          // Popover tinggal diam, dan yang benar-benar menggulir cuma daftarnya.
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder={t("kyc.cdd.occupationSearchPh")} className="h-9" />
            {/* max-h-80 = 320 px (papan `07` bagian C), bukan 300 px bawaan shadcn.
                Suku kedua `min()` adalah pengganti batas Popover yang baru saja
                dicabut, dan sengaja memakai ruang yang DILAPORKAN Radix, bukan dvh:
                yang menentukan muat atau tidak adalah jarak dari trigger ke tepi
                layar, bukan tinggi layar. Di 320×568 trigger duduk di tengah kartu,
                dan panel 355 px yang diukur sebelum perbaikan ini keluar 69 px di
                atas tepi atas — daftarnya terpotong justru di sisi yang dibaca
                pertama. `- 4.5rem` = kotak cari (36) + baris hitungan (36).
                Fallback 26rem membuat kelasnya jatuh persis ke max-h-80 kalau Radix
                tidak sempat menulis variabelnya (render pertama, avoidCollisions
                dimatikan). */}
            <CommandList className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height,26rem)-4.5rem))]">
              <CommandEmpty>{t("kyc.cdd.occupationEmpty")}</CommandEmpty>
              <CommandGroup>
                {OCCUPATIONS.map((option) => {
                  const label = t(cddOptionLabelKey("occupation", option));
                  return (
                    <CommandItem
                      key={option}
                      // `value` = teks yang dibaca nasabah; itulah yang disaring cmdk.
                      // Jawaban yang tersimpan diambil dari closure `option`, bukan
                      // dari argumen `onSelect` (cmdk mengecilkan hurufnya).
                      value={label}
                      onSelect={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                    >
                      {label}
                      <Check
                        className={cn(
                          "ml-auto size-4",
                          value === option ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <OccupationCount total={OCCUPATIONS.length} />
          </Command>
        </PopoverContent>
      </Popover>
      <FieldHelp id="occupation" error={error} />
    </Field>
  );
}
