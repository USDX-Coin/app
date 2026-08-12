"use client";

import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
export function KycStatusBanner({ status, onResubmit, resubmitActive }: KycStatusBannerProps) {
  const { t } = useLang();

  if (status.status === "UNVERIFIED") return null;

  if (status.status === "VERIFIED") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">{t("kyc.banner.verifiedTitle")}</p>
          <p className="text-sm opacity-90">{t("kyc.banner.verifiedBody")}</p>
          <Link
            href="/mint"
            className="mt-2 inline-block text-sm font-medium underline underline-offset-2"
          >
            {t("kyc.banner.goDashboard")}
          </Link>
        </div>
      </div>
    );
  }

  if (status.status === "PENDING") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
        <Clock className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">{t("kyc.banner.pendingTitle")}</p>
          <p className="text-sm opacity-90">{t("kyc.banner.pendingBody")}</p>
        </div>
      </div>
    );
  }

  // REJECTED
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-200">
      <XCircle className="mt-0.5 size-5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{t("kyc.banner.rejectedTitle")}</p>
        {status.rejectionReason && <p className="text-sm opacity-90">{status.rejectionReason}</p>}
        <p className="text-sm opacity-90">{t("kyc.banner.rejectedBody")}</p>
        {onResubmit && !resubmitActive && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 border-red-300 text-red-900 hover:bg-red-100 dark:border-red-700/60 dark:text-red-200 dark:hover:bg-red-950/60"
            onClick={onResubmit}
          >
            {t("kyc.banner.resubmit")}
          </Button>
        )}
      </div>
    </div>
  );
}
