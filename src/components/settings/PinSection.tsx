"use client";

// Baris "PIN transaksi" di kartu Akun halaman Pengaturan (USDX-651). Rumah
// utama untuk membuat dan mengubah PIN akun — PIN yang menyetujui transfer dan
// redeem custodial (pin.yaml). Status dibaca dari salinan profil `user.pinSet`
// (users.yaml § User): `true` → "Ubah PIN" (PinChangeDialog); `false`, atau sesi
// lama yang belum membawa field-nya, → "Buat PIN" (PinSetupDialog — kalau akun
// ternyata sudah punya, backend menjawab REAUTH_REQUIRED dan barisnya berbalik
// ke "Ubah PIN" lewat koreksi salinan di usePin).

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PinSetupDialog } from "@/components/shared/PinSetupDialog";
import { PinChangeDialog } from "@/components/shared/PinChangeDialog";
import { usePin } from "@/hooks/usePin";
import { useLang } from "@/providers/LanguageProvider";

export function PinSection() {
  const { t } = useLang();
  const { pinSet } = usePin();
  const [setupOpen, setSetupOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);

  return (
    <div
      data-slot="settings-pin"
      data-pin-set={pinSet === null ? "unknown" : String(pinSet)}
      className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{t("settings.pin.title")}</p>
          {pinSet !== null && (
            <Badge tone={pinSet ? "success" : "warning"}>
              {t(pinSet ? "settings.pin.set" : "settings.pin.notSet")}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-text">{t("settings.pin.desc")}</p>
      </div>
      {pinSet ? (
        <Button variant="outline" className="shrink-0" onClick={() => setChangeOpen(true)}>
          {t("settings.pin.change")}
        </Button>
      ) : (
        <Button variant="brand" className="shrink-0" onClick={() => setSetupOpen(true)}>
          {t("settings.pin.create")}
        </Button>
      )}

      <PinSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <PinChangeDialog open={changeOpen} onOpenChange={setChangeOpen} />
    </div>
  );
}
