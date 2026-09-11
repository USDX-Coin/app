"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { CustodialWalletSection } from "@/components/wallet/CustodialWalletSection";

// Where the app goes after onboarding — the same landing the login and
// verify-email flows used before this step existed.
const AFTER_ONBOARDING = "/mint";

/**
 * The optional onboarding step after email verification (USDX-566): "Belum
 * punya wallet? Kami buatkan." A user who declines lands on /mint and the app
 * behaves exactly as it did before this route existed; one who accepts watches
 * the wallet go PROVISIONING → ACTIVE right here, then continues.
 *
 * Lives in the dashboard group on purpose: it needs a session (the POST is
 * bearer-authed) and it is the first authenticated screen a new user sees, so
 * the sidebar being there is a feature — the balance card fills in as soon as
 * the wallet is ACTIVE.
 */
export function WalletOnboardingContent() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader crumbs={["wallet.onboarding.title"]} title="wallet.onboarding.title" />
      <Card className="mx-auto w-full max-w-3xl" data-slot="wallet-onboarding">
        <CustodialWalletSection
          variant="onboarding"
          onSkip={() => router.push(AFTER_ONBOARDING)}
          continueHref={AFTER_ONBOARDING}
        />
      </Card>
    </div>
  );
}
