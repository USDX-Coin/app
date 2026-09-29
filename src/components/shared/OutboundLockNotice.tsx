"use client";

// Banner "transfer & redeem ditahan sampai …" (custodial-wallet.md §6.1 no.6,
// USDX-717): faktor kedua akun baru dimatikan atau diganti, jadi uang keluar
// custodial ditahan 24 jam. Waktu dari `useCustodialStepUp().lockedUntil` — GET
// /api/v2/wallet `outboundLockedUntil` atau 409 `details.lockedUntil` — ditampilkan
// dalam waktu lokal. Dipakai halaman /send, redeem custodial dan Ringkasan keduanya.

import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export interface OutboundLockNoticeProps {
  /** ISO 8601; null = tidak terkunci (tidak merender apa pun). */
  lockedUntil: string | null;
  "data-testid"?: string;
}

export function OutboundLockNotice({ lockedUntil, "data-testid": testId }: OutboundLockNoticeProps) {
  const { t, lang } = useLang();
  if (!lockedUntil) return null;
  return (
    <Alert tone="warning" title={t("stepUp.lockedTitle")} data-testid={testId}>
      {t("stepUp.locked", { time: formatDateTime(lockedUntil, lang) })}
    </Alert>
  );
}
