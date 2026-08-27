"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import {
  CDD_OPTIONS,
  cddOptionLabelKey,
  type CddErrorField,
  type CddFormState,
  type CddSelectField,
} from "@/lib/kyc/cdd";

// CDD block of the /kyc form (USDX-545). Rendered as an extra SECTION of the
// existing single-step form — /kyc has never been a wizard, so a new step would
// have meant inventing a flow the ticket explicitly rules out ("ikut bentuk
// langkah KYC yang sudah ada, jangan buat alur baru"). It sits inside the same
// <form> and the same <fieldset disabled>, so PENDING still greys everything out.
//
// PII: `npwp` and `pepRelation` are plain controlled inputs whose value lives in
// React state only. They are NEVER written to localStorage/sessionStorage and
// never logged — /kyc has no draft-saving, and this component must not introduce
// one. tests/integration/kyc-cdd.spec.ts asserts both values are absent from web
// storage after a submit.

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CddSelect
          field="occupation"
          label={t("kyc.cdd.occupation")}
          value={form.occupation}
          error={errors.occupation}
          onChange={(v) => onChange("occupation", v as CddFormState["occupation"])}
        />
        <CddSelect
          field="sourceOfFunds"
          label={t("kyc.cdd.sourceOfFunds")}
          value={form.sourceOfFunds}
          error={errors.sourceOfFunds}
          onChange={(v) => onChange("sourceOfFunds", v as CddFormState["sourceOfFunds"])}
        />
        <CddSelect
          field="annualIncomeRange"
          label={t("kyc.cdd.annualIncomeRange")}
          value={form.annualIncomeRange}
          error={errors.annualIncomeRange}
          onChange={(v) => onChange("annualIncomeRange", v as CddFormState["annualIncomeRange"])}
        />
        <CddSelect
          field="transactionPurpose"
          label={t("kyc.cdd.transactionPurpose")}
          value={form.transactionPurpose}
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
        {/* Boolean, so a checkbox — the only honest control for "yes / no". It is
            deliberately UNCHECKED by default and the submit-time validator never
            requires it: an unchecked box IS the answer "no". */}
        <div className="flex items-start gap-2.5">
          <input
            id="pepStatus"
            type="checkbox"
            checked={form.pepStatus}
            onChange={(e) => {
              onChange("pepStatus", e.target.checked);
              // Un-checking retracts the declaration — drop the relation text with
              // it so a retracted answer can never reach the request body.
              if (!e.target.checked) onChange("pepRelation", "");
            }}
            className="mt-0.5 size-4 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Label htmlFor="pepStatus" className="items-start text-sm leading-snug font-normal">
            {t("kyc.cdd.pepStatus")}
          </Label>
        </div>

        {/* Conditional by design (USDX-545): the relation is only asked for — and
            only required — when the customer has declared a public office. */}
        {form.pepStatus && (
          <div className="mt-3">
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
        )}
      </div>
    </div>
  );
}

/**
 * One CDD dropdown. A native <select> rather than the shadcn/Radix Select:
 * `<fieldset disabled>` (the PENDING state of this form) propagates to it for
 * free, and mobile gets the OS picker. The technical enum member only ever lives
 * in the option's `value`; the visible text is always `t(cddOptionLabelKey(...))`.
 */
function CddSelect({
  field,
  label,
  value,
  error,
  onChange,
}: {
  field: CddSelectField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLang();

  return (
    <div>
      <Label htmlFor={field}>{label}</Label>
      <select
        id={field}
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
        {CDD_OPTIONS[field].map((option) => (
          <option key={option} value={option} className="text-foreground">
            {t(cddOptionLabelKey(field, option))}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}
