"use client";

import Link from "next/link";
import { Ban, LifeBuoy, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { HintBox, HintRow } from "@/components/auth/HintList";
import { UsdxMark } from "@/components/auth/UsdxMark";
import { useLang } from "@/providers/LanguageProvider";

/**
 * 37 · Akun ditangguhkan — reached from a 403 ACCOUNT_SUSPENDED on any call
 * (the session is cleared, USDX-205) or from "Lihat penjelasan" on Login.
 *
 * The login banner used to say "Silakan hubungi support" while Bantuan &
 * Dukungan is hidden precisely because there is no support channel anyone can
 * verify yet (ledger 20) — an instruction the user cannot follow. This screen
 * answers only what can be answered honestly: what happened, what it affects,
 * and what is still theirs. The last row says out loud that there is no channel,
 * rather than inventing an address; when one exists, it becomes a fourth row.
 *
 * It carries its own page shell instead of sitting inside `AuthLayout`: Figma
 * drops the brand panel here — a marketing pitch next to a suspension notice is
 * the wrong tone — and the route (`app/suspended`, USDX-205) is outside the
 * (auth) segment anyway. Logo top-left at 24, the same 448 column centred.
 */
export function SuspendedNotice() {
  const { t } = useLang();

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 pt-6 pb-12 lg:px-6">
      <UsdxMark />
      <div className="flex flex-1 items-start justify-center pt-8 lg:items-center lg:pt-0">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Empty className="gap-4 p-0">
            <EmptyHeader>
              <EmptyMedia kind="error">
                <Ban />
              </EmptyMedia>
              <EmptyTitle as="h1">{t("auth.suspended.title")}</EmptyTitle>
              <EmptyDescription>{t("auth.suspended.body")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {/* One way out, and it is not a promise: another account may work. */}
              <Button variant="outline" size="lg" asChild>
                <Link href="/login">{t("auth.backToLogin")}</Link>
              </Button>
            </EmptyContent>
          </Empty>

          <HintBox title={t("auth.suspended.helpTitle")}>
            <HintRow icon={<Wallet />}>{t("auth.suspended.helpWallet")}</HintRow>
            <HintRow icon={<LogOut />}>{t("auth.suspended.helpSessions")}</HintRow>
            <HintRow icon={<LifeBuoy />}>{t("auth.suspended.helpSupport")}</HintRow>
          </HintBox>
        </div>
      </div>
    </div>
  );
}
