"use client";

import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { alertTone } from "@/components/kyc/KycStatusSection";
import { useLang } from "@/providers/LanguageProvider";
import type { KycMyStatus } from "@/types";

interface KycStatusBannerProps {
  status: KycMyStatus;
  // REJECTED only: activates the form for the resubmit cycle. The button hides
  // once resubmission is underway.
  onResubmit?: () => void;
  resubmitActive?: boolean;
}

// Status banner per state (sot/phase-2/week1.md § Consumer App Flow + USDX-152):
// PENDING → in-review info; VERIFIED → success + dashboard link; REJECTED →
// reason + "Submit Ulang". UNVERIFIED shows nothing — the form is the CTA.
//
// Each state is an Alert with a tone token instead of the emerald/amber/red
// palette steps it used to hardcode: those never followed the theme, and the
// resubmit button carried four more of them just to tint itself red. The tone
// comes from `alertTone` -> `statusTone()`, not from a literal per branch, so a
// status cannot end up amber here and blue on /mint again.
export function KycStatusBanner({ status, onResubmit, resubmitActive }: KycStatusBannerProps) {
  const { t } = useLang();

  if (status.status === "UNVERIFIED") return null;

  if (status.status === "VERIFIED") {
    return (
      <Alert
        tone={alertTone(status.status)}
        icon={<CheckCircle2 />}
        title={t("kyc.banner.verifiedTitle")}
        action={
          // `asChild` keeps it an anchor — this is navigation, not a mutation.
          <Button variant="link" size="sm" asChild className="-ml-3">
            <Link href="/mint">{t("kyc.banner.goDashboard")}</Link>
          </Button>
        }
      >
        {t("kyc.banner.verifiedBody")}
      </Alert>
    );
  }

  if (status.status === "PENDING") {
    return (
      <Alert tone={alertTone(status.status)} icon={<Clock />} title={t("kyc.banner.pendingTitle")}>
        {t("kyc.banner.pendingBody")}
      </Alert>
    );
  }

  // REJECTED
  return (
    <Alert
      tone={alertTone(status.status)}
      icon={<XCircle />}
      title={t("kyc.banner.rejectedTitle")}
      action={
        onResubmit && !resubmitActive ? (
          <Button variant="outline" size="sm" onClick={onResubmit}>
            {t("kyc.banner.resubmit")}
          </Button>
        ) : null
      }
    >
      <span className="flex flex-col gap-1">
        {status.rejectionReason && <span>{status.rejectionReason}</span>}
        <span>{t("kyc.banner.rejectedBody")}</span>
      </span>
    </Alert>
  );
}
