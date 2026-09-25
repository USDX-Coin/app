"use client";

// Dialog Matikan 2FA (two-factor.yaml § disable, custodial-wallet.md §6.1 no.6,
// USDX-714). Peringatan kunci 24 jam tampil SEBELUM user mengonfirmasi: begitu 2FA
// dimatikan, backend (USDX-718) menahan transfer & redeem wallet custodial 24 jam —
// walaupun 2FA diaktifkan lagi. Konfirmasi either/or: kata sandi (bawaan) ATAU kode
// authenticator 6 digit (keputusan PM: tidak diperketat).

import { useState } from "react";
import { ShieldOff } from "lucide-react";
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
import { TwoFactorPasswordField } from "@/components/settings/TwoFactorPasswordField";
import { TwoFactorCodeField, isTotpShape } from "@/components/shared/TwoFactorCodeField";
import { useTwoFactor } from "@/hooks/useTwoFactor";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export interface TwoFactorDisableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TwoFactorDisableDialog({ open, onOpenChange }: TwoFactorDisableDialogProps) {
  const { t, lang } = useLang();
  const twoFactor = useTwoFactor();
  const { error, resetError, cooldownSeconds } = twoFactor;
  const [method, setMethod] = useState<"password" | "code">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = twoFactor.isDisabling;
  const locked = cooldownSeconds > 0;

  function reset() {
    setMethod("password");
    setPassword("");
    setCode("");
    setLocalError(null);
    resetError();
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function switchMethod(next: "password" | "code") {
    setMethod(next);
    setLocalError(null);
    resetError();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (method === "password" && !password) {
      setLocalError("twoFactor.errPasswordRequired");
      return;
    }
    if (method === "code" && !isTotpShape(code)) {
      setLocalError("twoFactor.errCodeFormat");
      return;
    }
    setLocalError(null);
    if (busy || locked) return;
    try {
      await twoFactor.disable(method === "password" ? { password } : { code });
      toast.success(t("twoFactor.disable.success"));
      reset();
      onOpenChange(false);
    } catch {
      // Dipetakan useTwoFactor → error / cooldownSeconds; tampil inline.
    }
  }

  const fieldError = localError
    ? t(localError)
    : error && error.where !== "form"
      ? t(error.key)
      : null;
  const formError = error?.where === "form" ? t(error.key) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" showCloseButton={!busy} data-testid="two-factor-disable-dialog">
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
              <ShieldOff className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <DialogTitle>{t("twoFactor.disable.title")}</DialogTitle>
              <DialogDescription>
                {t(method === "password" ? "twoFactor.disable.desc" : "twoFactor.disable.descCode")}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogBody className="gap-4">
            <Alert tone="warning" data-testid="two-factor-disable-warning">
              {t("twoFactor.disable.warning")}
            </Alert>
            {formError && (
              <Alert tone="danger" data-testid="two-factor-disable-error">
                {formError}
              </Alert>
            )}
            {method === "password" ? (
              <TwoFactorPasswordField
                id="two-factor-disable-password"
                value={password}
                onChange={setPassword}
                autoFocus
                disabled={busy}
                error={fieldError}
              />
            ) : (
              <TwoFactorCodeField
                id="two-factor-disable-code"
                kind="totp"
                label={t("twoFactor.enable.codeLabel")}
                value={code}
                onChange={setCode}
                autoFocus
                disabled={busy}
                error={fieldError}
              />
            )}
            <Button
              type="button"
              variant="link"
              className="self-start px-0"
              onClick={() => switchMethod(method === "password" ? "code" : "password")}
              disabled={busy}
            >
              {t(method === "password" ? "twoFactor.disable.useCode" : "twoFactor.disable.usePassword")}
            </Button>
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
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              className="flex-1"
              loading={busy}
              loadingLabel={t("twoFactor.disable.submitting")}
              cooldownSeconds={locked ? cooldownSeconds : undefined}
              cooldownLabel={t("auth.tryAgainIn", { duration: formatDuration(cooldownSeconds, lang) })}
            >
              {t("twoFactor.disable.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
