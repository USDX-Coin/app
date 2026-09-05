"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hourglass, Inbox, Mail, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LinkInline } from "@/components/ui/link-inline";
import { HintBox, HintRow } from "@/components/auth/HintList";
import { useLang } from "@/providers/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { getFailureText, getRateLimitSeconds } from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

// Landing after register (sot/phase-2/phase2.md § Pages, row 2). Prompts the user to
// check their inbox for the activation link, with a resend option (cooldown 60s).
//
// Figma 33. Three questions answered in order: where it went (the address in
// full, plus the 24 h TTL), what to do if it has not arrived (the box below),
// and how to get out. The status block is `Empty` with a neutral tint — the set
// has no neutral/success tone yet, so the media is overridden here (ledger).
export function CheckEmail() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const { t, lang } = useLang();
  const { resendVerification, resendVerificationLoading } = useAuth();
  const cooldown = useCooldown();

  async function handleResend() {
    try {
      await resendVerification({ email });
      cooldown.start(DEFAULT_COOLDOWN_SECONDS);
      toast.success(t("auth.check.sent"));
    } catch (err) {
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        // The countdown sits on the button, so the throttle needs no toast (B11).
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        return;
      }
      // The backend's own words never reach the toast (finding B3).
      toast.error(getFailureText(t, err, "auth.check.failed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Empty className="gap-4 p-0">
        <EmptyHeader>
          {/* Neutral, not success: nothing has succeeded yet — a mail is in
              flight. `bg-info/12` matches the tint formula the Alert uses. */}
          <EmptyMedia className="bg-info/12 text-info-text">
            <Mail />
          </EmptyMedia>
          <EmptyTitle as="h1">{t("auth.check.title")}</EmptyTitle>
          <EmptyDescription>
            {email ? t("auth.check.body", { email }) : t("auth.check.bodyNoEmail")}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          {email ? (
            // Outline, not brand: the real next step is in the user's inbox, not
            // on this screen.
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleResend}
              loading={resendVerificationLoading}
              loadingLabel={t("auth.check.sending")}
              cooldownSeconds={cooldown.remaining}
              cooldownLabel={t("auth.check.resendIn", {
                duration: formatDuration(cooldown.remaining, lang),
              })}
            >
              <RefreshCw />
              {t("auth.check.resend")}
            </Button>
          ) : (
            /* No ?email= (direct hit or a refresh): the page cannot resend
               anything, so it offers the action it CAN do instead of a resend
               button that fails with a toast. */
            <Button variant="outline" size="lg" asChild>
              <Link href="/register">{t("auth.check.registerAgain")}</Link>
            </Button>
          )}
        </EmptyContent>
      </Empty>

      <HintBox title={t("auth.check.helpTitle")}>
        <HintRow icon={<Inbox />}>{t("auth.check.helpSpam")}</HintRow>
        <HintRow icon={<Hourglass />}>{t("auth.check.helpWait")}</HintRow>
        {email && (
          <HintRow
            icon={<User />}
            action={
              <LinkInline asChild>
                <Link href="/register">{t("auth.check.registerAgain")}</Link>
              </LinkInline>
            }
          >
            {t("auth.check.helpWrongAddress")}
          </HintRow>
        )}
      </HintBox>

      <p className="text-center text-sm leading-5">
        <LinkInline asChild>
          <Link href="/login">{t("auth.backToLogin")}</Link>
        </LinkInline>
      </p>
    </div>
  );
}
