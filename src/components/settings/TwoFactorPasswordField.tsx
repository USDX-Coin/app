"use client";

// Kolom kata sandi untuk gerbang 2FA (enable, regenerate, disable — two-factor.yaml,
// USDX-714). `autoComplete="current-password"`: pengelola kata sandi boleh mengisi
// kata sandi akun yang tersimpan.

import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLang } from "@/providers/LanguageProvider";

export interface TwoFactorPasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Kalimat error yang sudah diterjemahkan. */
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function TwoFactorPasswordField({
  id,
  value,
  onChange,
  error = null,
  disabled = false,
  autoFocus = false,
}: TwoFactorPasswordFieldProps) {
  const { t } = useLang();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("twoFactor.password")}</FieldLabel>
      <Input
        id={id}
        type="password"
        autoComplete="current-password"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={`${id}-error`}
      />
      <FieldHelp id={id} error={error} />
    </Field>
  );
}
