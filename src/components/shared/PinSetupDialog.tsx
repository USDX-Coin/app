"use client";

// Dialog buat PIN — first-time set (`POST /api/v2/auth/pin/set`, pin.yaml § set,
// USDX-651). Dua kolom: PIN baru + ulangi PIN. Dibuka dari Pengaturan dan dari
// notice PIN_NOT_SET di alur transfer/redeem — dari sana user tidak meninggalkan
// alurnya: dialog ini menumpuk di atas Ringkasan, dan begitu sukses
// `user.pinSet` di store sudah `true` (usePin) sehingga dialog PIN transaksi
// langsung bisa dipakai.
//
// Bentuk dicek di sini sebelum berangkat (6 digit, kedua kolom sama). Yang dari
// server: 401 REAUTH_REQUIRED punya dua arti (pin.yaml § set, `details.pinSet`,
// USDX-697) — akun ternyata sudah punya PIN (salinan profil basi) → kalimat
// "gunakan Ubah PIN"; ATAU akun ber-wallet custodial belum punya PIN dan sesinya
// tidak segar → kalimat "login ulang dulu" + tombol Login ulang (useRelogin), yang
// membawa user kembali ke dialog ini di Pengaturan sesudah login. 429 = hitung
// mundur di tombol.

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
import { useRelogin } from "@/hooks/useRelogin";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dipanggil setelah PIN tersimpan dan dialog ditutup. */
  onCreated?: () => void;
}

export function PinSetupDialog({ open, onOpenChange, onCreated }: PinSetupDialogProps) {
  const { t, lang } = useLang();
  const { setPin, isSettingPin, setPinError, resetErrors, cooldownSeconds } = usePin();
  const relogin = useRelogin();
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const pinFormatError = touched && !isPinShape(pin) ? t("pin.errFormat") : null;
  const confirmError = touched && isPinShape(pin) && confirm !== pin ? t("pin.errMismatch") : null;
  const serverPinError = setPinError?.where === "new" ? t(setPinError.key) : null;
  const formError = setPinError?.where === "form" ? t(setPinError.key) : null;
  const locked = cooldownSeconds > 0;

  function reset() {
    setPinValue("");
    setConfirm("");
    setTouched(false);
    resetErrors();
  }

  function handleOpenChange(next: boolean) {
    if (!next && isSettingPin) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function handleRelogin() {
    reset();
    onOpenChange(false);
    relogin("create-pin");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Dialog ini bisa hidup di dalam <form> PinConfirmDialog (lewat
    // PinNotSetNotice); event submit sebuah portal tetap merambat di pohon React.
    e.stopPropagation();
    setTouched(true);
    if (!isPinShape(pin) || confirm !== pin || isSettingPin || locked) return;
    try {
      await setPin(pin);
      toast.success(t("pin.setup.success"));
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch {
      // Dipetakan usePin → setPinError / cooldownSeconds; tampil inline di bawah.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" showCloseButton={!isSettingPin} data-testid="pin-setup-dialog">
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
              <KeyRound className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <DialogTitle>{t("pin.setup.title")}</DialogTitle>
              <DialogDescription>{t("pin.setup.description")}</DialogDescription>
            </div>
          </DialogHeader>

          <DialogBody className="gap-4">
            {formError && (
              <Alert
                tone="danger"
                data-testid="pin-setup-error"
                action={
                  setPinError?.relogin ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleRelogin}>
                      {t("pin.relogin")}
                    </Button>
                  ) : undefined
                }
              >
                {formError}
              </Alert>
            )}
            <PinField
              id="pin-setup-new"
              label={t("pin.setup.new")}
              value={pin}
              onChange={setPinValue}
              autoFocus
              disabled={isSettingPin}
              error={pinFormatError ?? serverPinError}
            />
            <PinField
              id="pin-setup-confirm"
              label={t("pin.setup.confirm")}
              value={confirm}
              onChange={setConfirm}
              disabled={isSettingPin}
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
              disabled={isSettingPin}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="flex-1"
              loading={isSettingPin}
              loadingLabel={t("pin.setup.submitting")}
              cooldownSeconds={locked ? cooldownSeconds : undefined}
              cooldownLabel={t("auth.tryAgainIn", {
                duration: formatDuration(cooldownSeconds, lang),
              })}
            >
              {t("pin.setup.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
