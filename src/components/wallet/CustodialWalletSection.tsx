"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CustodialWalletOffer } from "@/components/wallet/CustodialWalletOffer";
import { CustodialWalletPanel } from "@/components/wallet/CustodialWalletPanel";
import { PinNotSetNotice } from "@/components/shared/PinNotSetNotice";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useSession } from "@/hooks/useSession";
import { useLang } from "@/providers/LanguageProvider";

interface CustodialWalletSectionProps {
  /**
   * `onboarding` — the optional step after email verification: the offer has a
   * "not now", and an ACTIVE wallet gets a "ready" heading + "continue".
   * `settings` — the same content for an existing user, no skip, no continue.
   */
  variant: "onboarding" | "settings";
  onSkip?: () => void;
  continueHref?: string;
}

/**
 * Offer-or-wallet, decided by `user.custodialWallet` from /auth/me (via the
 * hook) — the same component behind the onboarding step and the Settings page,
 * so both screens cannot drift apart (ticket: "user existing melihat CTA yang
 * sama"). Polls while PROVISIONING; the hook caps the poll.
 *
 * A wallet created HERE that turns ACTIVE on an account without a PIN gets one
 * "create your PIN now" invite (custodial-wallet.md §6 "Saran alur FE",
 * USDX-697): the session is still fresh at this moment, so creating the PIN needs
 * no re-login — later it may (pin.yaml § set). Not forced; a wallet that already
 * existed gets no invite (Settings → PIN is its home).
 */
export function CustodialWalletSection({ variant, onSkip, continueHref }: CustodialWalletSectionProps) {
  const { t } = useLang();
  // Refresh /auth/me on mount so a stale persisted `custodialWallet` (or one
  // missing from an older session) does not decide which half renders.
  useSession();
  const wallet = useCustodialWallet({ poll: true });
  const [createdHere, setCreatedHere] = useState(false);

  function create() {
    setCreatedHere(true);
    void wallet.create();
  }

  if (wallet.status === "none") {
    return (
      <CustodialWalletOffer
        onCreate={create}
        pending={wallet.createPending}
        error={wallet.createError}
        onSkip={variant === "onboarding" ? onSkip : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <CustodialWalletPanel wallet={wallet} readyHeading={variant === "onboarding"} />
      {createdHere && wallet.status === "ACTIVE" && wallet.pinSet === false && (
        <PinNotSetNotice tone="info" messageKey="pin.inviteAfterWallet" data-testid="wallet-pin-invite" />
      )}
      {variant === "onboarding" && continueHref && wallet.status === "ACTIVE" && (
        <Button variant="brand" size="lg" asChild className="w-full sm:w-auto sm:self-start">
          <Link href={continueHref}>{t("auth.verify.continue")}</Link>
        </Button>
      )}
    </div>
  );
}
