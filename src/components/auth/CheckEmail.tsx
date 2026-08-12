"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import { getErrorMessage, getRateLimitSeconds } from "@/lib/api/errors";
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
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        toast.error(t("auth.check.tooMany"));
        return;
      }
      toast.error(getErrorMessage(err, t("auth.check.failed")));
    }
  }

  return (
    <div className="text-center">
      <div className="mb-4 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <span className="text-3xl">✉</span>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-primary mb-2">{t("auth.check.title")}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {email ? (
          <>
            {bodyBefore}
            <strong>{email}</strong>
            {bodyAfter}
          </>
        ) : (
          t("auth.check.bodyNoEmail")
        )}
      </p>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleResend}
        disabled={resendVerificationLoading || cooldown.active}
      >
        {cooldown.active
          ? t("auth.check.resendIn", { duration: formatDuration(cooldown.remaining, lang) })
          : resendVerificationLoading
            ? t("auth.check.sending")
            : sent
              ? t("auth.check.resendAgain")
              : t("auth.check.resend")}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </div>
  );
}
