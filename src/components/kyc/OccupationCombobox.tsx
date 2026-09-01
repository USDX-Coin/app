"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
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

export interface OccupationComboboxProps {
  value: CddFormState["occupation"];
  error?: string;
  onChange: (value: CddFormState["occupation"]) => void;
}

export function OccupationCombobox({ value, error, onChange }: OccupationComboboxProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const selectedLabel = value ? t(cddOptionLabelKey("occupation", value)) : "";

  return (
    <div>
      <Label htmlFor="occupation">{t("kyc.cdd.occupation")}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="occupation"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!!error}
            data-testid="occupation-trigger"
            className={cn(
              "mt-1.5 h-9 w-full justify-between px-3 font-normal",
              // Sengaja tidak memakai `disabled` sendiri: tombol ini berada di dalam
              // <fieldset disabled> milik form, yang sudah mematikannya secara native.
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">{selectedLabel || t("kyc.cdd.occupationPh")}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          // `--radix-popover-trigger-width`: panel selebar tombolnya, supaya label
          // panjang seperti "Anggota Lembaga Tinggi Lainnya" tidak terpotong.
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder={t("kyc.cdd.occupationSearchPh")} className="h-9" />
            <CommandList>
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
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError message={error} />
    </div>
  );
}
