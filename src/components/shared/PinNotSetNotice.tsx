"use client";

// Notice "akun belum punya PIN" + tombol Buat PIN yang membuka PinSetupDialog di
// tempat (USDX-651). Dipakai TransferReview, RedeemReview dan PinConfirmDialog
// (saat `pinNotSet`): user tidak meninggalkan alur transfer/redeem yang sedang
// berjalan — dialog buat PIN menumpuk di atas Ringkasan, dan begitu tersimpan
// `user.pinSet` di store sudah `true` (usePin) sehingga pemanggil membaca
// `pinNotSet === false` dan langkah PIN terbuka kembali. Tidak ada callback yang
// perlu dipasang: salinan profil adalah satu-satunya sumber yang dibaca.

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PinSetupDialog } from "@/components/shared/PinSetupDialog";
import { useLang } from "@/providers/LanguageProvider";

export interface PinNotSetNoticeProps {
  "data-testid"?: string;
}

export function PinNotSetNotice({ "data-testid": testId }: PinNotSetNoticeProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Alert
        tone="warning"
        data-testid={testId}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("pin.createAction")}
          </Button>
        }
      >
        {t("pin.errNotSet")}
      </Alert>
      <PinSetupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
