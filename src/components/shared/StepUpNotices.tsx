"use client";

// Kartu ajakan aktivasi 2FA + banner kunci 24 jam untuk uang keluar custodial
// (custodial-wallet.md §6.1, USDX-717) — pasangan yang sama di form dan Ringkasan
// transfer serta redeem custodial, dari `useCustodialStepUp` lewat hook layarnya.
// Test id: `${testIdPrefix}-2fa-required` dan `${testIdPrefix}-locked`.

import { TwoFactorSetupNotice } from "@/components/shared/TwoFactorSetupNotice";
import { OutboundLockNotice } from "@/components/shared/OutboundLockNotice";

export interface StepUpNoticesProps {
  /** Pemilik wallet belum mengaktifkan 2FA. */
  setupRequired: boolean;
  /** ISO 8601 selama uang keluar ditahan; null = tidak. */
  lockedUntil: string | null;
  /** Kalimat ajakan: kirim (/send) atau redeem. */
  action: "send" | "redeem";
  testIdPrefix: string;
}

export function StepUpNotices({ setupRequired, lockedUntil, action, testIdPrefix }: StepUpNoticesProps) {
  return (
    <>
      {setupRequired && (
        <TwoFactorSetupNotice
          data-testid={`${testIdPrefix}-2fa-required`}
          messageKey={action === "send" ? "stepUp.setupRequiredSend" : "stepUp.setupRequiredRedeem"}
          tone="warning"
        />
      )}
      <OutboundLockNotice data-testid={`${testIdPrefix}-locked`} lockedUntil={lockedUntil} />
    </>
  );
}
