"use client";

// Notice "akun belum punya PIN" + tombol Buat PIN yang membuka PinSetupDialog di
// tempat (USDX-651). Dipakai TransferReview, RedeemReview dan PinConfirmDialog
// (saat `pinNotSet`): user tidak meninggalkan alur transfer/redeem yang sedang
// berjalan — dialog buat PIN menumpuk di atas Ringkasan, dan begitu tersimpan
// `user.pinSet` di store sudah `true` (usePin) sehingga pemanggil membaca
// `pinNotSet === false` dan langkah PIN terbuka kembali. Tidak ada callback yang
// perlu dipasang: salinan profil adalah satu-satunya sumber yang dibaca.
//
// Juga dipakai sebagai ajakan "Buat PIN" tepat sesudah wallet custodial dibuat
// (CustodialWalletSection, USDX-697) — kalimat dan nadanya diganti lewat props.

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PinSetupDialog } from "@/components/shared/PinSetupDialog";
import { useLang } from "@/providers/LanguageProvider";

export interface PinNotSetNoticeProps {
  "data-testid"?: string;
  /** Kunci i18n kalimatnya; bawaan = "akun belum punya PIN". */
  messageKey?: string;
  tone?: "warning" | "info";
}

export function PinNotSetNotice({
  "data-testid": testId,
  messageKey = "pin.errNotSet",
  tone = "warning",
}: PinNotSetNoticeProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Alert
        tone={tone}
        data-testid={testId}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("pin.createAction")}
          </Button>
        }
      >
        {t(messageKey)}
      </Alert>
      <PinSetupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
