"use client";

// Pintu lupa-PIN di web (custodial-wallet.md §5.1 "Lupa PIN di web", USDX-696).
// Tautan "Lupa PIN?" → satu kalimat + tombol "Login ulang". Satu-satunya cara
// membuat PIN baru tanpa PIN lama adalah sesi password-auth SEGAR (< 5 menit,
// pin.yaml § set), dan login sukses sekaligus membersihkan lockout `pin` — jadi
// tombolnya memakai alur login ulang yang sama dengan Buat PIN (useRelogin, USDX-697)
// dengan niat `forgot-pin`: sesudah login user mendarat di Pengaturan dengan dialog
// "Buat PIN baru" terbuka (PinSection). Batal = tidak ada yang berubah, tidak ada
// penanda.
//
// Dipasang di dialog PIN transaksi (PinConfirmDialog) dan dialog Ubah PIN
// (PinChangeDialog), termasuk saat keduanya terkunci hitung mundur.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRelogin } from "@/hooks/useRelogin";
import { useLang } from "@/providers/LanguageProvider";

export function ForgotPinLink() {
  const { t } = useLang();
  const relogin = useRelogin();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="self-start px-0"
        data-testid="forgot-pin-link"
        onClick={() => setOpen(true)}
      >
        {t("pin.forgot.link")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md" data-testid="forgot-pin-dialog">
          <DialogHeader>
            <div className="flex min-w-0 flex-col">
              <DialogTitle>{t("pin.forgot.title")}</DialogTitle>
              <DialogDescription>{t("pin.forgot.description")}</DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="brand"
              size="lg"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                relogin("forgot-pin");
              }}
            >
              {t("pin.relogin")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
