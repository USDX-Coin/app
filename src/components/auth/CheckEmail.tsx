"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LinkInline } from "@/components/ui/link-inline";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import { getFailureText, getRateLimitSeconds } from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

// Landing after register (sot/phase-2/phase2.md § Pages, row 2). Prompts the user to
// check their inbox for the activation link, with a resend option (cooldown 60s).
export function CheckEmail() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const { t, lang } = useLang();
  const { resendVerification, resendVerificationLoading } = useAuth();
  const [sent, setSent] = useState(false);
  const cooldown = useCooldown();

  // {email} slot lets each language place the address naturally in the sentence.
  const [bodyBefore, bodyAfter] = t("auth.check.body").split("{email}");

  async function handleResend() {
    if (!email) {
      toast.error(t("auth.check.missingEmail"));
      return;
    }
    try {
      await resendVerification({ email });
      setSent(true);
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
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <span className="text-3xl">✉</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("auth.check.title")}
        </h1>
        <p className="text-sm text-muted-text">
          {email ? (
            <>
              {bodyBefore}
              <strong className="text-foreground">{email}</strong>
              {bodyAfter}
            </>
          ) : (
            t("auth.check.bodyNoEmail")
          )}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleResend}
        loading={resendVerificationLoading}
        loadingLabel={t("auth.check.sending")}
        cooldownSeconds={cooldown.remaining}
        cooldownLabel={t("auth.check.resendIn", {
          duration: formatDuration(cooldown.remaining, lang),
        })}
      >
        {sent ? t("auth.check.resendAgain") : t("auth.check.resend")}
      </Button>

      <p className="text-sm text-muted-text">
        <LinkInline asChild>
          <Link href="/login">{t("auth.backToLogin")}</Link>
        </LinkInline>
      </p>
    </div>
  );
}
