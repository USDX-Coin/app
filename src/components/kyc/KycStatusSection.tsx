"use client";

import Link from "next/link";
import { CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getMyKycStatus } from "@/lib/api/kyc-api";
import { KYC_STATUS_KEY } from "@/hooks/useKyc";
import { useSession } from "@/hooks/useSession";
import { useVerifiedBannerVisibility } from "@/hooks/useVerifiedBannerVisibility";
import { useAuthStore } from "@/stores/authStore";
import { useLang } from "@/providers/LanguageProvider";
import { cn } from "@/lib/utils";
import type { KycStatus } from "@/types";

// Status tracker on the dashboard home (USDX-153 — sot/phase-2/phase2.md § Pages
// row 8, amended: lives on /mint, not /dashboard). Unlike the /kyc banner this
// renders all four states, including UNVERIFIED as a warning with a "Complete
// KYC" CTA. Mounting also refreshes /v2/auth/me (useSession) per the ticket.
export function KycStatusSection() {
  const { t } = useLang();
  useSession();
  const userId = useAuthStore((s) => s.user?.id) ?? null;

  const statusQuery = useQuery({
    queryKey: KYC_STATUS_KEY,
    queryFn: getMyKycStatus,
    staleTime: 30_000,
    retry: false,
  });

  // VERIFIED banner is transient + once-per-user (USDX-175); the other states
  // stay permanent. Hook is called unconditionally, gated by `enabled`.
  const verifiedVisible = useVerifiedBannerVisibility(
    statusQuery.data?.status === "VERIFIED",
    userId,
  );

  if (!statusQuery.data) return null;
  const status: KycStatus = statusQuery.data.status;
  if (status === "VERIFIED" && !verifiedVisible) return null;

  const styles: Record<KycStatus, string> = {
    UNVERIFIED:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
    PENDING:
      "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-200",
    VERIFIED:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    REJECTED:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-200",
  };

  const icon = {
    UNVERIFIED: <ShieldAlert className="mt-0.5 size-5 shrink-0" />,
    PENDING: <Clock className="mt-0.5 size-5 shrink-0" />,
    VERIFIED: <CheckCircle2 className="mt-0.5 size-5 shrink-0" />,
    REJECTED: <XCircle className="mt-0.5 size-5 shrink-0" />,
  }[status];

  const title = {
    UNVERIFIED: t("kyc.section.unverifiedTitle"),
    PENDING: t("kyc.banner.pendingTitle"),
    VERIFIED: t("kyc.banner.verifiedTitle"),
    REJECTED: t("kyc.banner.rejectedTitle"),
  }[status];

  const body = {
    UNVERIFIED: t("kyc.section.unverifiedBody"),
    PENDING: t("kyc.banner.pendingBody"),
    VERIFIED: t("kyc.banner.verifiedBody"),
    REJECTED: statusQuery.data.rejectionReason ?? t("kyc.banner.rejectedBody"),
  }[status];

  const ctaLabel =
    status === "UNVERIFIED"
      ? t("kyc.lock.completeKyc")
      : status === "REJECTED"
        ? t("kyc.banner.resubmit")
        : null;

  return (
    <div
      data-testid="kyc-status-section"
      className={cn("flex items-start gap-3 rounded-lg border p-4", styles[status])}
    >
      {icon}
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm opacity-90">{body}</p>
        {ctaLabel && (
          <Link
            href="/kyc"
            className="mt-2 inline-block text-sm font-medium underline underline-offset-2"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
