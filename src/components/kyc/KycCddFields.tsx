"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useLang } from "@/providers/LanguageProvider";
import {
  CDD_OPTIONS,
  cddOptionLabelKey,
  type CddErrorField,
  type CddFormState,
} from "@/lib/kyc/cdd";
import { KycSelect } from "./KycSelect";
import { OccupationCombobox } from "./OccupationCombobox";

// Blok CDD form /kyc (USDX-545, diperluas USDX-586). Dirender sebagai SATU BAGIAN
// tambahan dari form satu langkah yang sudah ada — /kyc tidak pernah jadi wizard,
// jadi langkah baru berarti mengarang alur yang justru dilarang tiketnya ("perluas
// form yang ada, jangan bikin alur baru"). Ia duduk di dalam <form> dan <fieldset
// disabled> yang sama, sehingga keadaan PENDING tetap meredupkan semuanya.
//
// PII: `npwp`, `pepRelation`, `employerAddress`, dan `employerPhone` adalah input
// terkendali biasa yang nilainya hidup di state React saja. Semuanya TIDAK PERNAH
// ditulis ke localStorage/sessionStorage dan tidak pernah di-log — /kyc tidak punya
// penyimpanan draf, dan komponen ini tidak boleh memperkenalkannya.
// tests/integration/kyc-cdd.spec.ts memastikan nilainya absen dari web storage
// setelah submit.

export interface KycCddFieldsProps {
  form: CddFormState;
  errors: Partial<Record<CddErrorField, string | undefined>>;
  onChange: <K extends keyof CddFormState>(key: K, value: CddFormState[K]) => void;
}

export function KycCddFields({ form, errors, onChange }: KycCddFieldsProps) {
  const { t } = useLang();

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{t("kyc.cdd.sectionTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("kyc.cdd.sectionHint")}</p>
      </div>

      {/* Pekerjaan berdiri sendiri, tidak di dalam grid dua kolom: 99 pilihan butuh
          panel selebar mungkin supaya label panjang terbaca utuh. */}
      <OccupationCombobox
        value={form.occupation}
        error={errors.occupation}
        onChange={(v) => onChange("occupation", v)}
      />

      {/* Alamat & telepon tempat kerja — Pasal 25 (1) a angka 1 butir g), yang
          berakhir "jika ada". Ditandai opsional di label, dan tidak pernah
          divalidasi: nasabah yang tidak bekerja tidak punya jawabannya, dan memaksa
          mereka mengarang alamat memperburuk mutu data CDD. Ditaruh persis di bawah
          pekerjaan karena hanya punya arti bersamanya. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="employerAddress">{t("kyc.cdd.employerAddress")}</Label>
          <Input
            id="employerAddress"
            autoComplete="off"
            placeholder={t("kyc.cdd.employerAddressPh")}
            value={form.employerAddress}
            onChange={(e) => onChange("employerAddress", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="employerPhone">{t("kyc.cdd.employerPhone")}</Label>
          <Input
            id="employerPhone"
            inputMode="tel"
            autoComplete="off"
            placeholder={t("kyc.cdd.employerPhonePh")}
            value={form.employerPhone}
            onChange={(e) => onChange("employerPhone", e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KycSelect
          id="sourceOfFunds"
          label={t("kyc.cdd.sourceOfFunds")}
          value={form.sourceOfFunds}
          options={CDD_OPTIONS.sourceOfFunds}
          labelKey={(v) => cddOptionLabelKey("sourceOfFunds", v)}
          error={errors.sourceOfFunds}
          onChange={(v) => onChange("sourceOfFunds", v as CddFormState["sourceOfFunds"])}
        />
        <KycSelect
          id="annualIncomeRange"
          label={t("kyc.cdd.annualIncomeRange")}
          value={form.annualIncomeRange}
          options={CDD_OPTIONS.annualIncomeRange}
          labelKey={(v) => cddOptionLabelKey("annualIncomeRange", v)}
          error={errors.annualIncomeRange}
          onChange={(v) => onChange("annualIncomeRange", v as CddFormState["annualIncomeRange"])}
        />
        <KycSelect
          id="netWorthRange"
          label={t("kyc.cdd.netWorthRange")}
          value={form.netWorthRange}
          options={CDD_OPTIONS.netWorthRange}
          labelKey={(v) => cddOptionLabelKey("netWorthRange", v)}
          error={errors.netWorthRange}
          onChange={(v) => onChange("netWorthRange", v as CddFormState["netWorthRange"])}
        />
        <KycSelect
          id="transactionPurpose"
          label={t("kyc.cdd.transactionPurpose")}
          value={form.transactionPurpose}
          options={CDD_OPTIONS.transactionPurpose}
          labelKey={(v) => cddOptionLabelKey("transactionPurpose", v)}
          error={errors.transactionPurpose}
          onChange={(v) => onChange("transactionPurpose", v as CddFormState["transactionPurpose"])}
        />
      </div>

      <div>
        <Label htmlFor="npwp">{t("kyc.cdd.npwp")}</Label>
        <Input
          id="npwp"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("kyc.cdd.npwpPh")}
          value={form.npwp}
          onChange={(e) => onChange("npwp", e.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("kyc.cdd.npwpHint")}</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        {/* Boolean, jadi checkbox — satu-satunya kontrol yang jujur untuk "ya / tidak".
            Sengaja TIDAK tercentang secara default dan validator tidak pernah
            mewajibkannya: kotak yang tidak tercentang ITULAH jawaban "tidak". */}
        <div className="flex items-start gap-2.5">
          <input
            id="pepStatus"
            type="checkbox"
            checked={form.pepStatus}
            onChange={(e) => {
              onChange("pepStatus", e.target.checked);
              // Membatalkan centang menarik kembali pernyataannya — buang relasi DAN
              // sumber kekayaan bersamanya supaya jawaban yang ditarik tidak pernah
              // sampai ke body request.
              if (!e.target.checked) {
                onChange("pepRelation", "");
                onChange("sourceOfWealth", "");
              }
            }}
            className="mt-0.5 size-4 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Label htmlFor="pepStatus" className="items-start text-sm leading-snug font-normal">
            {t("kyc.cdd.pepStatus")}
          </Label>
        </div>

        {/* Bersyarat by design: relasi dan sumber kekayaan hanya ditanyakan — dan
            hanya diwajibkan — saat nasabah menyatakan ada jabatan publik.
            `sourceOfWealth` berdasar Pasal 37 ayat (1) huruf d (EDD berkala untuk
            PEP), BUKAN Pasal 25 — menandai seseorang PEP tanpa tahu dari mana
            hartanya berasal membuat EDD-nya kosong isi tapi terlihat sudah
            dikerjakan. */}
        {form.pepStatus && (
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="pepRelation">{t("kyc.cdd.pepRelation")}</Label>
              <Input
                id="pepRelation"
                autoComplete="off"
                placeholder={t("kyc.cdd.pepRelationPh")}
                value={form.pepRelation}
                onChange={(e) => onChange("pepRelation", e.target.value)}
                className="mt-1.5"
                aria-invalid={!!errors.pepRelation}
              />
              <FieldError message={errors.pepRelation} />
            </div>
            <KycSelect
              id="sourceOfWealth"
              label={t("kyc.cdd.sourceOfWealth")}
              value={form.sourceOfWealth}
              options={CDD_OPTIONS.sourceOfWealth}
              labelKey={(v) => cddOptionLabelKey("sourceOfWealth", v)}
              error={errors.sourceOfWealth}
              onChange={(v) => onChange("sourceOfWealth", v as CddFormState["sourceOfWealth"])}
            />
          </div>
        )}
      </div>
    </div>
  );
}
