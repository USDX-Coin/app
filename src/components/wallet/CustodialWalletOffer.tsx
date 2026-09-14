"use client";

import { Check, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLang } from "@/providers/LanguageProvider";

interface CustodialWalletOfferProps {
  /** Onboarding only: the way past the offer. Settings has no "skip". */
  onSkip?: () => void;
}

/**
 * "Belum punya wallet? Kami buatkan." — the offer shown to a user with no
 * custodial wallet, on onboarding (with a skip) and in Settings (without).
 * It promises what the user gets, in their words: nothing to install, an
 * address or QR to receive with, and their own wallet untouched (§0
 * "berdampingan"). The word "custodial" is deliberately absent.
 *
 * Creating a wallet is not offered yet (custodial-wallet.md §1, amandemen
 * 14 Sep 2026): where the "Buatkan saya wallet" button stood there is the same
 * "Segera hadir" pill the sidebar puts on Bridge and Send, so this screen never
 * sends POST /api/v2/wallet.
 */
export function CustodialWalletOffer({ onSkip }: CustodialWalletOfferProps) {
  const { t } = useLang();

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Badge tone="coming-soon" data-slot="wallet-offer-soon">
          {t("nav.soon")}
        </Badge>
        {onSkip && (
          <Button variant="ghost" size="lg" onClick={onSkip} className="w-full sm:w-auto">
            {t("wallet.offer.skip")}
          </Button>
        )}
      </div>
      {onSkip && <p className="text-xs text-muted-text">{t("wallet.offer.skipHint")}</p>}
    </div>
  );
}
