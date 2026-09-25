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
// Kolomnya `PinField` (bersama layar buat/ubah PIN, USDX-651). Di bawahnya
// tautan "Lupa PIN?" (USDX-696) — tetap ada saat terkunci hitung mundur.
//
// Di bawah PIN: kolom "Kode authenticator" (custodial-wallet.md §6.1, USDX-717) —
// 2FA wajib untuk uang keluar custodial, dikirim sebagai `twoFactorCode` di body
// yang sama. Bawaannya 6 digit dari aplikasi; "Pakai backup code" menggantinya
// dengan kolom backup code (huruf + angka + strip). Galat kode (`twoFactorErrorKey`)
// dan lockout scope `2fa-stepup` (`twoFactorCooldownSeconds`) tampil di kolom
// kode; PIN yang sudah diketik tidak dikosongkan. Nilai kode tidak pernah dicatat.

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
import { Button } from "@/components/ui/button";
import { PinField, isPinShape } from "@/components/shared/PinField";
import { TwoFactorCodeField, isTotpShape } from "@/components/shared/TwoFactorCodeField";
import { PinNotSetNotice } from "@/components/shared/PinNotSetNotice";
import { ForgotPinLink } from "@/components/shared/ForgotPinLink";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export interface PinConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Apa yang sedang disetujui — mis. "Kirim 25 USDX ke 0x5aAe…BeAed". */
  description?: React.ReactNode;
  /** Dipanggil dengan PIN 6 digit + kode authenticator/backup code; pemanggil yang mengirim keduanya ke API. */
  onSubmit: (pin: string, twoFactorCode: string) => void;
  isSubmitting?: boolean;
  /** Kunci i18n error dari pemanggil (pin.errInvalid, pin.errNotSet, …). */
  errorKey?: string | null;
  /** Sisa detik lockout `pin` (429 TOO_MANY_ATTEMPTS). > 0 → tombol terkunci. */
  cooldownSeconds?: number;
  /** Kunci i18n galat kode 2FA (stepUp.errInvalid, stepUp.errRequired). */
  twoFactorErrorKey?: string | null;
  /** Sisa detik lockout `2fa-stepup` (429 `details.scope`). > 0 → kolom kode + tombol terkunci. */
  twoFactorCooldownSeconds?: number;
  /** Akun belum punya PIN (401 PIN_NOT_SET / `user.pinSet === false`) → notice + tombol Buat PIN (USDX-651). */
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
  twoFactorErrorKey = null,
  twoFactorCooldownSeconds = 0,
  pinNotSet = false,
  confirmLabel,
}: PinConfirmDialogProps) {
  const { t, lang } = useLang();
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [touched, setTouched] = useState(false);
  // Pemanggil juga menutup dialog sendiri (galat Ringkasan) tanpa lewat
  // handleOpenChange. Saat dibuka lagi kolom kode dikosongkan: kode TOTP yang sudah
  // menyetujui satu niat tidak berlaku untuk niat lain dan backup code hangus sekali
  // pakai (§6.1 no.5, redeem.yaml) — mengirimnya ulang hanya membakar satu percobaan
  // `2fa-stepup`. PIN tetap seperti sebelumnya.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCode("");
      setUseBackup(false);
      setTouched(false);
    }
  }

  const locked = cooldownSeconds > 0;
  const codeLocked = twoFactorCooldownSeconds > 0;
  const formatError = touched && !isPinShape(pin) ? t("pin.errFormat") : null;
  const serverError = errorKey ? t(errorKey) : null;
  const inlineError = formatError ?? serverError;
  const codeReady = useBackup ? code !== "" : isTotpShape(code);
  const codeFormatError =
    touched && !codeReady ? t(useBackup ? "stepUp.errBackupRequired" : "stepUp.errFormat") : null;
  const codeError = codeLocked
    ? t("stepUp.errLocked", { time: formatDuration(twoFactorCooldownSeconds, lang) })
    : (codeFormatError ?? (twoFactorErrorKey ? t(twoFactorErrorKey) : null));
  const canSubmit =
    isPinShape(pin) && codeReady && !isSubmitting && !locked && !codeLocked && !pinNotSet;

  function handleOpenChange(next: boolean) {
    // Jangan bisa ditutup di tengah permintaan: PIN sudah berangkat bersama body,
    // dan menutup dialog tidak membatalkannya.
    if (!next && isSubmitting) return;
    if (!next) {
      setPin("");
      setCode("");
      setUseBackup(false);
      setTouched(false);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(pin, code);
  }

  function toggleBackup() {
    setCode("");
    setUseBackup((v) => !v);
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
              <PinNotSetNotice data-testid="pin-confirm-not-set" />
            ) : (
              <>
                <PinField
                  id="pin-confirm"
                  label={t("pin.label")}
                  value={pin}
                  onChange={setPin}
                  autoFocus
                  disabled={isSubmitting || locked}
                  hint={t("pin.hint")}
                  error={
                    locked
                      ? t("pin.errLocked", { time: formatDuration(cooldownSeconds, lang) })
                      : inlineError
                  }
                />
                <ForgotPinLink disabled={isSubmitting} />
                <TwoFactorCodeField
                  id="pin-confirm-2fa"
                  kind={useBackup ? "any" : "totp"}
                  label={t(useBackup ? "stepUp.backupLabel" : "stepUp.codeLabel")}
                  value={code}
                  onChange={setCode}
                  disabled={isSubmitting || codeLocked}
                  hint={t(useBackup ? "stepUp.backupHint" : "stepUp.codeHint")}
                  error={codeError}
                />
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="self-start px-0"
                  onClick={toggleBackup}
                  disabled={isSubmitting}
                >
                  {t(useBackup ? "stepUp.useApp" : "stepUp.useBackup")}
                </Button>
              </>
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
