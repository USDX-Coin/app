"use client";

import Link from "next/link";
import { UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { CustodialWalletSection } from "@/components/wallet/CustodialWalletSection";
import { PinSection } from "@/components/settings/PinSection";
import { useLang } from "@/providers/LanguageProvider";

/**
 * Pengaturan — a real page since USDX-566. Its first tenant is the custodial
 * wallet: an existing user without one sees the same "dikasih wallet" offer as
 * onboarding, one who has it sees the receiving address (copy + QR), status
 * and balance. The Account card holds the transaction PIN (create / change,
 * USDX-651) — the approval every custodial transfer and redeem needs. Password,
 * language and theme still live on /profile, and the card says so instead of
 * duplicating them.
 */
export function SettingsPageContent() {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader crumbs={["sidebar.more", "nav.settings"]} title="nav.settings" />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card data-slot="settings-wallet">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Wallet className="size-4" aria-hidden />
            {t("settings.wallet.section")}
          </h2>
          <CustodialWalletSection variant="settings" />
        </Card>

        <Card data-slot="settings-account">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <UserRound className="size-4" aria-hidden />
            {t("settings.account.title")}
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-text">{t("settings.account.desc")}</p>
            <Button variant="outline" asChild className="shrink-0">
              <Link href="/profile">{t("soon.toProfile")}</Link>
            </Button>
          </div>
          <PinSection />
        </Card>
      </div>
    </div>
  );
}
