"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkInline } from "@/components/ui/link-inline";
import { translateValidation, validateEmail } from "@/lib/validations";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import { getFailureText, getRateLimitSeconds, isValidationError } from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const { t, lang } = useLang();
  const { forgotPassword, forgotPasswordLoading } = useAuth();
  const [email, setEmail] = useState("");
  // An i18n key, whatever it came from — the validator or the 422 branch below.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const cooldown = useCooldown();

  // {email} slot lets each language place the address naturally in the sentence.
  const [checkBefore, checkAfter] = t("auth.forgot.checkBody").split("{email}");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorKey(emailErr);
      return;
    }
    setErrorKey(null);
    try {
      // Backend returns a generic 200 even for unknown emails (avoid enumeration),
      // so we always advance to the check-email screen on success.
      await forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        // The button carries the countdown, so the throttle needs no toast (B11).
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        return;
      }
      // 422 VALIDATION_ERROR (invalid email body) → inline on the field, not a
      // toast (USDX-214; client-side email validation usually catches it first).
      // The backend's own wording never reaches the field (finding B3).
      if (isValidationError(err)) {
        setErrorKey("validation.email.format");
        return;
      }
      toast.error(getFailureText(t, err, "auth.forgot.failed"));
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <span className="text-3xl">✉</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("auth.forgot.checkTitle")}
          </h1>
          <p className="text-sm text-muted-text">
            {checkBefore}
            <strong className="text-foreground">{email}</strong>
            {checkAfter}
          </p>
        </div>
        <Button variant="outline" size="lg" className="w-full" asChild>
          <Link href="/login">{t("auth.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("auth.forgot.title")}
        </h1>
        <p className="text-sm text-muted-text">{t("auth.forgot.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.forgot.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errorKey}
            aria-describedby="email-error"
          />
          <FieldHelp id="email" error={translateValidation(t, errorKey)} />
        </Field>

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          loading={forgotPasswordLoading}
          loadingLabel={t("auth.forgot.sending")}
          cooldownSeconds={cooldown.remaining}
          cooldownLabel={t("auth.tryAgainIn", {
            duration: formatDuration(cooldown.remaining, lang),
          })}
        >
          {t("auth.forgot.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-text">
        {t("auth.forgot.remember")}{" "}
        <LinkInline asChild>
          <Link href="/login">{t("auth.forgot.loginLink")}</Link>
        </LinkInline>
      </p>
    </div>
  );
}
