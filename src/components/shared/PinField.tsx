"use client";

// Satu kolom PIN 6 digit (pin.yaml `^[0-9]{6}$`), dipakai PinConfirmDialog
// (USDX-567) serta PinSetupDialog / PinChangeDialog (USDX-651) supaya ketiganya
// berperilaku sama: `type="password"` + `autoComplete="one-time-code"` — angka
// tidak tampil di layar dan tidak masuk saran isi-otomatis kata sandi (PIN bukan
// kata sandi, pengelola kata sandi tidak boleh menawarkan menyimpannya);
// `inputMode="numeric"` memunculkan papan angka di ponsel; huruf dibuang saat
// diketik; panjang dipotong di 6.

import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const PIN_LENGTH = 6;
const PIN_REGEX = /^[0-9]{6}$/;

/** Bentuk PIN sudah lengkap (6 digit). Yang lain ditolak backend dengan 422 tanpa membakar attempt. */
export function isPinShape(value: string): boolean {
  return PIN_REGEX.test(value);
}

/** Buang selain digit, potong di 6 — dipanggil pada tiap ketikan. */
export function sanitizePin(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);
}

export interface PinFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: React.ReactNode;
  /** Kalimat error yang sudah diterjemahkan; menggantikan `hint` selama ada. */
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PinField({
  id,
  label,
  value,
  onChange,
  hint,
  error = null,
  disabled = false,
  autoFocus = false,
}: PinFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={PIN_LENGTH}
        placeholder="••••••"
        value={value}
        onChange={(e) => onChange(sanitizePin(e.target.value))}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={`${id}-error`}
        className="text-center text-2xl tracking-[0.5em] md:text-2xl"
      />
      <FieldHelp id={id} hint={hint} error={error} />
    </Field>
  );
}
