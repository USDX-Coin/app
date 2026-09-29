"use client";

// Ajakan "aktifkan 2FA" + tombol yang membuka TwoFactorEnableDialog di tempat
// (custodial-wallet.md §6.1 "Web", USDX-714) — pola PinNotSetNotice. Dipakai
// CustodialWalletSection tepat sesudah wallet custodial dibuat; kalimat dan
// nadanya lewat props supaya layar uang (USDX-717) bisa memakainya juga.

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TwoFactorEnableDialog } from "@/components/settings/TwoFactorEnableDialog";
import { useLang } from "@/providers/LanguageProvider";

export interface TwoFactorSetupNoticeProps {
  "data-testid"?: string;
  /** Kunci i18n kalimatnya. */
  messageKey: string;
  tone?: "warning" | "info";
}

export function TwoFactorSetupNotice({
  "data-testid": testId,
  messageKey,
  tone = "info",
}: TwoFactorSetupNoticeProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Alert
        tone={tone}
        data-testid={testId}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("twoFactor.inviteAction")}
          </Button>
        }
      >
        {t(messageKey)}
      </Alert>
      <TwoFactorEnableDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
