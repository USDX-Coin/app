"use client";

// Satu kolom kode 2FA (two-factor.yaml, USDX-714), dipakai layar kode login,
// pemulihan email dan dialog 2FA di Pengaturan supaya semuanya berperilaku sama.
// `kind`:
// - `totp` — kode 6 digit dari aplikasi authenticator (atau OTP email 6 digit):
//   papan angka di ponsel, selain digit dibuang, dipotong di 6.
// - `any` — kode authenticator ATAU backup code (huruf + angka + strip, peka
//   huruf besar/kecil): hanya spasi yang dibuang.
// `autoComplete="one-time-code"`: kode sekali pakai, bukan kata sandi — pengelola
// kata sandi tidak menawarkan menyimpannya, ponsel bisa menyarankan dari SMS/app.
// Nilainya tidak pernah dicatat di mana pun (custodial-wallet.md §6.1 "Log").

import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type TwoFactorCodeKind = "totp" | "any";

const TOTP_LENGTH = 6;
// Batas atas DTO backend (`@MaxLength(64)`).
const ANY_MAX_LENGTH = 64;
const TOTP_REGEX = /^[0-9]{6}$/;

/** Kode authenticator 6 digit lengkap. */
export function isTotpShape(value: string): boolean {
  return TOTP_REGEX.test(value);
}

/** Dipanggil pada tiap ketikan. */
export function sanitizeTwoFactorCode(raw: string, kind: TwoFactorCodeKind): string {
  if (kind === "totp") return raw.replace(/[^0-9]/g, "").slice(0, TOTP_LENGTH);
  return raw.replace(/\s/g, "").slice(0, ANY_MAX_LENGTH);
}

export interface TwoFactorCodeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  kind: TwoFactorCodeKind;
  hint?: React.ReactNode;
  /** Kalimat error yang sudah diterjemahkan; menggantikan `hint` selama ada. */
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function TwoFactorCodeField({
  id,
  label,
  value,
  onChange,
  kind,
  hint,
  error = null,
  disabled = false,
  autoFocus = false,
}: TwoFactorCodeFieldProps) {
  const totp = kind === "totp";
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="text"
        inputMode={totp ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        maxLength={totp ? TOTP_LENGTH : ANY_MAX_LENGTH}
        placeholder={totp ? "123456" : undefined}
        value={value}
        onChange={(e) => onChange(sanitizeTwoFactorCode(e.target.value, kind))}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={`${id}-error`}
        className="font-mono tracking-widest"
      />
      <FieldHelp id={id} hint={hint} error={error} />
    </Field>
  );
}
