"use client";

// Dialog konfirmasi PIN (pin.yaml — mekanisme PIN existing dipakai apa adanya,
// USDX-567). Satu komponen untuk dua jalur uang custodial: transfer
// (`POST /api/v2/wallet/transfer`) dan redeem custodial (`POST /api/v2/redeem`
// dengan `pin`). Di kedua jalur inilah SATU-SATUNYA titik persetujuan user —
// setelah ini tidak ada layar tanda tangan wallet — jadi dialog memperlihatkan
// apa yang disetujui (`description`) tepat di atas kolom PIN.
//
// Dialog ini tidak memanggil API: pemanggil yang mengirim PIN bersama body-nya
// (PIN memang bagian body transfer/redeem, bukan endpoint terpisah). Yang
// diterima dari pemanggil: `errorKey` (kunci i18n hasil pemetaan 401 INVALID_PIN /
// PIN_NOT_SET), `cooldownSeconds` (sisa lockout 429 TOO_MANY_ATTEMPTS — hitung
// mundur milik pemanggil, `useCooldown`), dan `isSubmitting`.
//
// PIN 6 digit dicek bentuknya di sini sebelum dikirim: bentuk salah ditolak
// backend dengan 422 tanpa membakar attempt, tapi lebih baik tidak berangkat.
// `type="password"` + `autoComplete="one-time-code"`: angka tidak tampil di layar
// dan tidak masuk saran isi-otomatis kata sandi.

import { useState } from "react";
import { KeyRound } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export const PIN_LENGTH = 6;
const PIN_REGEX = /^[0-9]{6}$/;

export interface PinConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Apa yang sedang disetujui — mis. "Kirim 25 USDX ke 0x5aAe…BeAed". */
  description?: React.ReactNode;
  /** Dipanggil dengan PIN 6 digit; pemanggil yang mengirimnya ke API. */
  onSubmit: (pin: string) => void;
  isSubmitting?: boolean;
  /** Kunci i18n error dari pemanggil (pin.errInvalid, pin.errNotSet, …). */
  errorKey?: string | null;
  /** Sisa detik lockout `pin` (429 TOO_MANY_ATTEMPTS). > 0 → tombol terkunci. */
  cooldownSeconds?: number;
  /** Akun belum punya PIN (401 PIN_NOT_SET / `user.pinSet === false`). */
  pinNotSet?: boolean;
  confirmLabel?: React.ReactNode;
}

export function PinConfirmDialog({
  open,
  onOpenChange,
  description,
  onSubmit,
  isSubmitting = false,
  errorKey = null,
  cooldownSeconds = 0,
  pinNotSet = false,
  confirmLabel,
}: PinConfirmDialogProps) {
  const { t, lang } = useLang();
  const [pin, setPin] = useState("");
  const [touched, setTouched] = useState(false);

  const locked = cooldownSeconds > 0;
  const formatError = touched && !PIN_REGEX.test(pin) ? t("pin.errFormat") : null;
  const serverError = errorKey ? t(errorKey) : null;
  const inlineError = formatError ?? serverError;
  const canSubmit = PIN_REGEX.test(pin) && !isSubmitting && !locked && !pinNotSet;

  function handleOpenChange(next: boolean) {
    // Jangan bisa ditutup di tengah permintaan: PIN sudah berangkat bersama body,
    // dan menutup dialog tidak membatalkannya.
    if (!next && isSubmitting) return;
    if (!next) {
      setPin("");
      setTouched(false);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(pin);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" showCloseButton={!isSubmitting}>
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
              <KeyRound className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <DialogTitle>{t("pin.title")}</DialogTitle>
              <DialogDescription>{description ?? t("pin.hint")}</DialogDescription>
            </div>
          </DialogHeader>

          <DialogBody>
            {pinNotSet ? (
              <Alert tone="warning">{t("pin.errNotSet")}</Alert>
            ) : (
              <Field>
                <FieldLabel htmlFor="pin-confirm">{t("pin.label")}</FieldLabel>
                <Input
                  id="pin-confirm"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={PIN_LENGTH}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH))}
                  disabled={isSubmitting || locked}
                  aria-invalid={!!inlineError}
                  aria-describedby="pin-confirm-error"
                  className="text-center text-2xl tracking-[0.5em] md:text-2xl"
                />
                <FieldHelp
                  id="pin-confirm"
                  hint={t("pin.hint")}
                  error={
                    locked
                      ? t("pin.errLocked", { time: formatDuration(cooldownSeconds, lang) })
                      : inlineError
                  }
                />
              </Field>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="flex-1"
              disabled={!canSubmit && !isSubmitting}
              loading={isSubmitting}
              loadingLabel={t("common.processing")}
            >
              {confirmLabel ?? t("pin.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
