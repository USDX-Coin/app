"use client";

import Link from "next/link";
import { CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/ui/status-badge";
import { getMyKycStatus } from "@/lib/api/kyc-api";
import { KYC_STATUS_KEY } from "@/hooks/useKyc";
import { useSession } from "@/hooks/useSession";
import { useVerifiedBannerVisibility } from "@/hooks/useVerifiedBannerVisibility";
import { useAuthStore } from "@/stores/authStore";
import { useLang } from "@/providers/LanguageProvider";
import type { KycStatus } from "@/types";

// `statusTone()` is the single status -> tone map for the whole product, so this
// banner does not keep a private copy: PENDING used to read `info` here and
// `warning` on /kyc, which is exactly the split the map exists to end. Only
// `neutral` needs translating — Alert has no neutral tone, and UNVERIFIED is the
// one status here that carries a "finish your KYC" CTA, so it lands on warning.
export function alertTone(status: KycStatus): "info" | "success" | "warning" | "danger" {
  const tone = statusTone(status);
  // `neutral` and `coming-soon` are Badge-only tones; Alert has neither. Both
  // land on warning here, which is right for the one status that reaches it:
  // UNVERIFIED, the only state on this banner that carries a "finish it" CTA.
  return tone === "neutral" || tone === "coming-soon" ? "warning" : tone;
}

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

  // The per-status glyph is kept — it carries meaning the tone alone does not.
  // (UNVERIFIED and PENDING now share a tone; the icon is what tells them apart.)
  const icon = {
    UNVERIFIED: <ShieldAlert />,
    PENDING: <Clock />,
    VERIFIED: <CheckCircle2 />,
    REJECTED: <XCircle />,
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
    <Alert
      data-testid="kyc-status-section"
      tone={alertTone(status)}
      icon={icon}
      title={title}
      action={
        ctaLabel && (
          // Stays an anchor (`asChild`), so it keeps the link role the KYC gate
          // specs navigate by. `-ml-3` cancels the link variant's own padding so
          // the label lines up with the text above it.
          <Button variant="link" size="sm" asChild className="-ml-3">
            <Link href="/kyc">{ctaLabel}</Link>
          </Button>
        )
      }
    >
      {body}
    </Alert>
  );
}
