"use client";

import { Alert } from "@/components/ui/alert";
import { useLang } from "@/providers/LanguageProvider";

/**
 * B2 — a 401 used to drop the user on a bare login form with no explanation, so
 * the natural reading was "I typed my password wrong". `ApiClientBridge` now
 * appends `?sesi=habis` when it bounces an expired session here, and this says
 * what actually happened: the session ran out, nothing is wrong with the
 * account, and anything half-typed elsewhere is gone.
 */
export function SessionExpiredNotice() {
  const { t } = useLang();
  return (
    <Alert tone="warning" title={t("auth.sessionExpired.title")}>
      {t("auth.sessionExpired.desc")}
    </Alert>
  );
}
