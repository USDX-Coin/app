"use client";

// Baris "Verifikasi dua langkah (2FA)" di kartu Keamanan halaman Pengaturan
// (custodial-wallet.md §6.1 "Web", USDX-714). 2FA wajib untuk transfer & redeem
// wallet custodial; sebelum ini web tidak punya jalan untuk mengaktifkannya.
// Status dibaca dari salinan profil `user.twoFactorEnabled` (GET /auth/me, users.yaml
// § User): mati → Aktifkan 2FA; aktif → Backup code baru + Matikan. Sesi lama tanpa
// field-nya → tidak ada aksi sampai /auth/me menjawab: "Aktifkan" pada akun yang
// ternyata sudah ber-2FA akan memutar secret authenticator yang sedang dipakai.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackupCodesRegenerateDialog } from "@/components/settings/BackupCodesRegenerateDialog";
import { TwoFactorDisableDialog } from "@/components/settings/TwoFactorDisableDialog";
import { TwoFactorEnableDialog } from "@/components/settings/TwoFactorEnableDialog";
import { useTwoFactor } from "@/hooks/useTwoFactor";
import { useLang } from "@/providers/LanguageProvider";

export function TwoFactorSection() {
  const { t } = useLang();
  const { twoFactorEnabled } = useTwoFactor();
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  return (
    <div
      data-slot="settings-2fa"
      data-two-factor={twoFactorEnabled === null ? "unknown" : String(twoFactorEnabled)}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{t("settings.2fa.title")}</p>
          {twoFactorEnabled !== null && (
            <Badge tone={twoFactorEnabled ? "success" : "warning"}>
              {t(twoFactorEnabled ? "settings.2fa.on" : "settings.2fa.off")}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-text">{t("settings.2fa.desc")}</p>
      </div>
      {twoFactorEnabled === true && (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRegenerateOpen(true)}>
            {t("settings.2fa.regenerate")}
          </Button>
          <Button variant="outline" onClick={() => setDisableOpen(true)}>
            {t("settings.2fa.disable")}
          </Button>
        </div>
      )}
      {twoFactorEnabled === false && (
        <Button variant="brand" className="shrink-0" onClick={() => setEnableOpen(true)}>
          {t("settings.2fa.enable")}
        </Button>
      )}

      <TwoFactorEnableDialog open={enableOpen} onOpenChange={setEnableOpen} />
      <TwoFactorDisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <BackupCodesRegenerateDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
    </div>
  );
}
