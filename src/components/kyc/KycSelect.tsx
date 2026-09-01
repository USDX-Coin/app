"use client";

import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

// Satu dropdown form KYC. Sebelum USDX-586 komponen ini hidup sebagai `CddSelect`
// di dalam KycCddFields.tsx; diangkat ke berkas sendiri (tanpa mengubah markup atau
// kelasnya) begitu blok identitas ikut butuh dropdown — supaya identitas dan CDD
// memakai kontrol yang sama persis, bukan dua salinan className yang bisa melenceng.
//
// `<select>` bawaan, bukan shadcn/Radix Select: `<fieldset disabled>` (keadaan
// PENDING form ini) merambat ke sana gratis, dan di ponsel nasabah dapat picker OS.
// Nilai teknis enum HANYA hidup di `value` option; teks yang terlihat selalu hasil
// `t(...)`.
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
  error?: string;
  onChange: (value: string) => void;
}

export function KycSelect({ id, label, value, options, labelKey, error, onChange }: KycSelectProps) {
  const { t } = useLang();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn(
          "mt-1.5 h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          value === "" && "text-muted-foreground",
        )}
      >
        <option value="">{t("kyc.cdd.selectPh")}</option>
        {options.map((option) => (
          <option key={option} value={option} className="text-foreground">
            {t(labelKey(option))}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}
