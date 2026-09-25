"use client";

// Dialog Backup code baru (two-factor.yaml § regenerateBackupCodes, USDX-714):
// kata sandi → SELURUH set lama mati, set baru tampil sekali → "Selesai" hanya
// sesudah user menyatakan sudah menyimpannya. Set baru = faktor kedua DIGANTI
// (custodial-wallet.md §6.1 no.6c, sot@6a55e6b): backend (USDX-718) menahan
// transfer & redeem custodial 24 jam — peringatannya tampil SEBELUM konfirmasi. 2FA ternyata mati (salinan profil
// basi) → kalimatnya, dan salinan dikoreksi oleh useTwoFactor.

import { useState } from "react";
import { KeyRound } from "lucide-react";
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
import { useTwoFactor } from "@/hooks/useTwoFactor";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export interface BackupCodesRegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackupCodesRegenerateDialog({ open, onOpenChange }: BackupCodesRegenerateDialogProps) {
  const { t, lang } = useLang();
  const twoFactor = useTwoFactor();
  const { error, resetError, cooldownSeconds } = twoFactor;
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = twoFactor.isRegenerating;
  const locked = cooldownSeconds > 0;

  function reset() {
    setPassword("");
    setCodes(null);
    setSaved(false);
    setLocalError(null);
    resetError();
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (codes) {
      if (saved) handleOpenChange(false);
      return;
    }
    if (!password) {
      setLocalError("twoFactor.errPasswordRequired");
      return;
    }
    setLocalError(null);
    if (busy || locked) return;
    try {
      setCodes(await twoFactor.regenerate(password));
      setPassword("");
      toast.success(t("twoFactor.regenerate.success"));
    } catch {
      // Dipetakan useTwoFactor → error / cooldownSeconds; tampil inline.
    }
  }

  const passwordError = localError
    ? t(localError)
    : error?.where === "password"
      ? t(error.key)
      : null;
  const formError = error && error.where !== "password" ? t(error.key) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" showCloseButton={!busy} data-testid="backup-codes-regenerate-dialog">
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
              <KeyRound className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <DialogTitle>{t("twoFactor.regenerate.title")}</DialogTitle>
              {!codes && <DialogDescription>{t("twoFactor.regenerate.desc")}</DialogDescription>}
            </div>
          </DialogHeader>

          <DialogBody className="gap-4">
            {formError && (
              <Alert tone="danger" data-testid="backup-codes-regenerate-error">
                {formError}
              </Alert>
            )}
            {codes ? (
              <BackupCodesPanel codes={codes} saved={saved} onSavedChange={setSaved} />
            ) : (
              <>
                <Alert tone="warning" data-testid="backup-codes-regenerate-warning">
                  {t("twoFactor.regenerate.warning")}
                </Alert>
                <TwoFactorPasswordField
                  id="backup-codes-regenerate-password"
                  value={password}
                  onChange={setPassword}
                  autoFocus
                  disabled={busy}
                  error={passwordError}
                />
              </>
            )}
          </DialogBody>

          <DialogFooter>
            {codes ? (
              <Button type="submit" variant="brand" size="lg" className="flex-1" disabled={!saved}>
                {t("twoFactor.done")}
              </Button>
            ) : (
              <>
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
                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="flex-1"
                  loading={busy}
                  loadingLabel={t("twoFactor.checking")}
                  cooldownSeconds={locked ? cooldownSeconds : undefined}
                  cooldownLabel={t("auth.tryAgainIn", { duration: formatDuration(cooldownSeconds, lang) })}
                >
                  {t("twoFactor.regenerate.submit")}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
