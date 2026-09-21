"use client";

// Dialog ubah PIN (`POST /api/v2/auth/pin/change`, pin.yaml § change,
// USDX-651). Tiga kolom: PIN saat ini + PIN baru + ulangi PIN baru. PIN lama
// salah = 401 INVALID_PIN di bawah kolom PIN lama, dan attempt-nya masuk lockout
// scope `pin` yang sama dengan transfer/redeem — lima kali salah mengunci
// semuanya 15 menit (429 → hitung mundur di tombol). PIN baru yang sama dengan
// yang lama ditolak di sini dulu (422 PIN_UNCHANGED kalau lolos).
//
// Jalur lupa-PIN (login ulang → set tanpa PIN lama, pin.yaml § set "sesi segar")
// sengaja tidak ada di dialog ini: itu alur re-auth, bukan ubah PIN.

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
import { PinField, isPinShape } from "@/components/shared/PinField";
import { usePin } from "@/hooks/usePin";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export interface PinChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PinChangeDialog({ open, onOpenChange }: PinChangeDialogProps) {
  const { t, lang } = useLang();
  const { changePin, isChangingPin, changePinError, resetErrors, cooldownSeconds } = usePin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const currentFormatError = touched && !isPinShape(current) ? t("pin.errFormat") : null;
  const nextFormatError = touched && !isPinShape(next) ? t("pin.errFormat") : null;
  const unchangedError =
    touched && isPinShape(next) && next === current ? t("pin.errUnchanged") : null;
  const confirmError = touched && isPinShape(next) && confirm !== next ? t("pin.errMismatch") : null;
  const serverCurrentError = changePinError?.where === "current" ? t(changePinError.key) : null;
  const serverNextError = changePinError?.where === "new" ? t(changePinError.key) : null;
  const formError = changePinError?.where === "form" ? t(changePinError.key) : null;
  const locked = cooldownSeconds > 0;

  const clientValid = isPinShape(current) && isPinShape(next) && next !== current && confirm === next;

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setTouched(false);
    resetErrors();
  }

  function handleOpenChange(open: boolean) {
    if (!open && isChangingPin) return;
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Dialog ini bisa hidup di dalam <form> PinConfirmDialog (lewat
    // PinNotSetNotice); event submit sebuah portal tetap merambat di pohon React.
    e.stopPropagation();
    setTouched(true);
    if (!clientValid || isChangingPin || locked) return;
    try {
      await changePin({ currentPin: current, newPin: next });
      toast.success(t("pin.change.success"));
      reset();
      onOpenChange(false);
    } catch {
      // Dipetakan usePin → changePinError / cooldownSeconds; tampil inline di bawah.
      // Kolom tidak dikosongkan: PIN lama salah tidak boleh menghapus PIN baru yang
      // sudah diketik dua kali.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" showCloseButton={!isChangingPin} data-testid="pin-change-dialog">
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
              <KeyRound className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <DialogTitle>{t("pin.change.title")}</DialogTitle>
              <DialogDescription>{t("pin.change.description")}</DialogDescription>
            </div>
          </DialogHeader>

          <DialogBody className="gap-4">
            {formError && (
              <Alert tone="danger" data-testid="pin-change-error">
                {formError}
              </Alert>
            )}
            <PinField
              id="pin-change-current"
              label={t("pin.change.current")}
              value={current}
              onChange={setCurrent}
              autoFocus
              disabled={isChangingPin}
              error={currentFormatError ?? serverCurrentError}
            />
            <PinField
              id="pin-change-new"
              label={t("pin.change.new")}
              value={next}
              onChange={setNext}
              disabled={isChangingPin}
              error={nextFormatError ?? unchangedError ?? serverNextError}
            />
            <PinField
              id="pin-change-confirm"
              label={t("pin.change.confirm")}
              value={confirm}
              onChange={setConfirm}
              disabled={isChangingPin}
              error={confirmError}
            />
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={isChangingPin}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="flex-1"
              loading={isChangingPin}
              loadingLabel={t("pin.change.submitting")}
              cooldownSeconds={locked ? cooldownSeconds : undefined}
              cooldownLabel={t("auth.tryAgainIn", {
                duration: formatDuration(cooldownSeconds, lang),
              })}
            >
              {t("pin.change.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
