"use client";

import { Check, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { getFailureKey, isWalletServiceUnavailable } from "@/lib/api/errors";
import { useLang } from "@/providers/LanguageProvider";

interface CustodialWalletOfferProps {
  onCreate: () => void;
  pending: boolean;
  /** `createError` from `useCustodialWallet` — rendered as a sentence, never raw. */
  error: unknown;
  /** Onboarding only: the way past the offer. Settings has no "skip". */
  onSkip?: () => void;
}

// Which sentence a failed POST /wallet gets. 503 has its own line because it
// carries the one reassurance that matters ("nothing was changed"); a dead
// network / 500 keeps the shared error copy; everything else says "try again".
function createErrorKey(error: unknown): string | null {
  if (!error) return null;
  if (isWalletServiceUnavailable(error)) return "wallet.error.unavailable";
  return getFailureKey(error) ?? "wallet.error.create";
}

/**
 * "Belum punya wallet? Kami buatkan." — the offer shown to a user with no
 * custodial wallet, on onboarding (with a skip) and in Settings (without).
 * It promises what the user gets, in their words: nothing to install, an
 * address or QR to receive with, and their own wallet untouched (§0
 * "berdampingan"). The word "custodial" is deliberately absent.
 *
 * Whether a wallet can be created here is a build-time switch
 * (`env.walletCreateEnabled`, custodial-wallet.md §1 amandemen 21 Sep 2026,
 * USDX-699): ON (dev build, mock) → the "Buatkan saya wallet" button, which
 * sends POST /api/v2/wallet; OFF (production, any unknown backend) → the same
 * "Segera hadir" pill the sidebar puts on Bridge and Send (hotfix USDX-684),
 * and this screen never sends POST /api/v2/wallet.
 */
export function CustodialWalletOffer({ onCreate, pending, error, onSkip }: CustodialWalletOfferProps) {
  const { t } = useLang();
  const canCreate = env.walletCreateEnabled;
  const errorKey = canCreate ? createErrorKey(error) : null;

  return (
    <div data-slot="wallet-offer" className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-text">
          <Wallet className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg leading-7 font-semibold text-foreground">
            {t("wallet.offer.headline")}
          </h2>
          <p className="text-sm leading-5 text-muted-text">{t("wallet.offer.desc")}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {["wallet.offer.point1", "wallet.offer.point2", "wallet.offer.point3"].map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      {errorKey && <Alert tone="danger">{t(errorKey)}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {canCreate ? (
          <Button
            variant="brand"
            size="lg"
            onClick={onCreate}
            loading={pending}
            loadingLabel={t("wallet.offer.creating")}
            className="w-full sm:w-auto"
          >
            {t("wallet.offer.create")}
          </Button>
        ) : (
          <Badge tone="coming-soon" data-slot="wallet-offer-soon">
            {t("nav.soon")}
          </Badge>
        )}
        {onSkip && (
          <Button variant="ghost" size="lg" onClick={onSkip} disabled={pending} className="w-full sm:w-auto">
            {t("wallet.offer.skip")}
          </Button>
        )}
      </div>
      {onSkip && <p className="text-xs text-muted-text">{t("wallet.offer.skipHint")}</p>}
    </div>
  );
}
