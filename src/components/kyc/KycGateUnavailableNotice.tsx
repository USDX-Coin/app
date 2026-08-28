"use client";

import { useLang } from "@/providers/LanguageProvider";

// Sits under a transaction CTA that is disabled because neither /v2/kyc/me nor
// /v2/auth/me could be reached — NOT because the customer failed verification.
// Deliberately plain: it states the situation and the one thing that helps. No
// blame, no retry button, no dialog. The loading state shows nothing at all, since
// it is momentary and resolves on its own.
export function KycGateUnavailableNotice() {
  const { t } = useLang();
  return (
    <p
      data-testid="kyc-gate-unavailable"
      role="status"
      className="mt-2 text-center text-sm text-muted-foreground"
    >
      {t("kyc.gate.unreachable")}
    </p>
  );
}
