"use client";

// Dialog Aktifkan 2FA (two-factor.yaml § enable → verify, custodial-wallet.md §6.1
// "Web", USDX-714). Dua langkah:
// 1. Kata sandi → `POST /auth/2fa/enable` → `{ totpUri, backupCodes }`.
// 2. QR dari `totpUri` — DIRENDER LOKAL (qrcode.react), URI tidak pernah dikirim ke
//    layanan pihak ketiga — + kunci untuk input manual + backup code (tampil
//    sekali, "sudah saya simpan") → kode 6 digit → `POST /auth/2fa/verify` → aktif.
// 2FA belum aktif sampai langkah 2 selesai; menutup dialog di tengah jalan
// meninggalkan enroll yang tidak aktif (enable berikutnya memutarnya ulang).
//
// Dibuka dari Pengaturan (TwoFactorSection) dan dari ajakan sesudah wallet
// custodial dibuat (CustodialWalletSection).

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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
import { BackupCodesPanel } from "@/components/settings/BackupCodesPanel";
import { TwoFactorPasswordField } from "@/components/settings/TwoFactorPasswordField";
import { TwoFactorCodeField, isTotpShape } from "@/components/shared/TwoFactorCodeField";
import { useTwoFactor } from "@/hooks/useTwoFactor";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import type { TwoFactorEnrollment } from "@/types";

export interface TwoFactorEnableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dipanggil setelah 2FA aktif dan dialog ditutup. */
  onEnabled?: () => void;
}

/** Kunci `secret` dari otpauth:// untuk input manual; null bila tak terbaca. */
function totpSecretOf(totpUri: string): string | null {
  const match = /[?&]secret=([^&]+)/i.exec(totpUri);
  return match ? decodeURIComponent(match[1]) : null;
}

export function TwoFactorEnableDialog({ open, onOpenChange, onEnabled }: TwoFactorEnableDialogProps) {
  const { t, lang } = useLang();
  const twoFactor = useTwoFactor();
  const { error, resetError, cooldownSeconds } = twoFactor;
  const [password, setPassword] = useState("");
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null);
  const [saved, setSaved] = useState(false);
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = twoFactor.isEnabling || twoFactor.isVerifying;
  const locked = cooldownSeconds > 0;
  const secret = enrollment ? totpSecretOf(enrollment.totpUri) : null;

  function reset() {
    setPassword("");
    setEnrollment(null);
    setSaved(false);
    setCode("");
    setLocalError(null);
    resetError();
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!password) {
      setLocalError("twoFactor.errPasswordRequired");
      return;
    }
    setLocalError(null);
    if (busy || locked) return;
    try {
      setEnrollment(await twoFactor.enable(password));
      setPassword("");
    } catch {
      // Dipetakan useTwoFactor → error / cooldownSeconds; tampil inline.
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isTotpShape(code)) {
      setLocalError("twoFactor.errCodeFormat");
      return;
    }
    setLocalError(null);
    if (busy || locked || !saved) return;
    try {
      await twoFactor.verify(code);
      toast.success(t("twoFactor.enable.success"));
      reset();
      onOpenChange(false);
      onEnabled?.();
    } catch {
      // Dipetakan useTwoFactor.
    }
  }

  const passwordError = localError && !enrollment ? t(localError) : error?.where === "password" ? t(error.key) : null;
  const codeError = localError && enrollment ? t(localError) : error?.where === "code" ? t(error.key) : null;
  const formError = error?.where === "form" ? t(error.key) : null;
  const cooldownLabel = t("auth.tryAgainIn", { duration: formatDuration(cooldownSeconds, lang) });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" showCloseButton={!busy} data-testid="two-factor-enable-dialog">
        <form onSubmit={enrollment ? submitCode : submitPassword} className="contents">
          <DialogHeader>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
              <ShieldCheck className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <DialogTitle>{t("twoFactor.enable.title")}</DialogTitle>
              <DialogDescription>
                {t(enrollment ? "twoFactor.enable.scanDesc" : "twoFactor.enable.passwordDesc")}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogBody className="gap-4">
            {formError && (
              <Alert tone="danger" data-testid="two-factor-enable-error">
                {formError}
              </Alert>
            )}
            {enrollment ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  {/* Bingkai putih di kedua tema: pembaca QR butuh modul gelap di atas dasar terang. */}
                  <div className="rounded-xl border border-border bg-white p-3">
                    <QRCodeSVG
                      value={enrollment.totpUri}
                      size={160}
                      level="M"
                      role="img"
                      aria-label={t("twoFactor.enable.qrAlt")}
                    />
                  </div>
                  {secret && (
                    <div className="flex w-full flex-col gap-1 text-center">
                      <p className="text-sm text-muted-text">{t("twoFactor.enable.manual")}</p>
                      <code className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all text-foreground">
                        {secret}
                      </code>
                    </div>
                  )}
                </div>
                <BackupCodesPanel codes={enrollment.backupCodes} saved={saved} onSavedChange={setSaved} />
                <TwoFactorCodeField
                  id="two-factor-enable-code"
                  kind="totp"
                  label={t("twoFactor.enable.codeLabel")}
                  value={code}
                  onChange={setCode}
                  disabled={busy}
                  error={codeError}
                />
              </>
            ) : (
              <TwoFactorPasswordField
                id="two-factor-enable-password"
                value={password}
                onChange={setPassword}
                autoFocus
                disabled={busy}
                error={passwordError}
              />
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
            {enrollment ? (
              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="flex-1"
                disabled={!saved}
                loading={twoFactor.isVerifying}
                loadingLabel={t("twoFactor.enable.submitting")}
                cooldownSeconds={locked ? cooldownSeconds : undefined}
                cooldownLabel={cooldownLabel}
              >
                {t("twoFactor.enable.submit")}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="flex-1"
                loading={twoFactor.isEnabling}
                loadingLabel={t("twoFactor.checking")}
                cooldownSeconds={locked ? cooldownSeconds : undefined}
                cooldownLabel={cooldownLabel}
              >
                {t("twoFactor.continue")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
