"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkInline } from "@/components/ui/link-inline";
import { useLang } from "@/providers/LanguageProvider";
import { translateValidation, validateEmail } from "@/lib/validations";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
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
      <div className="flex flex-col gap-6">
        {/*
         * Neutral tone, not success. The endpoint answers 200 for an address
         * that was never registered — deliberately, so nobody can probe for
         * accounts — which means this screen does not know whether anything was
         * sent. A green tick would claim knowledge it does not have, so the copy
         * says "if … is registered" and the tint stays informational.
         */}
        <Empty className="gap-4 p-0">
          <EmptyHeader>
            <EmptyMedia className="bg-info/12 text-info-text">
              <Mail />
            </EmptyMedia>
            <EmptyTitle as="h1">{t("auth.forgot.checkTitle")}</EmptyTitle>
            <EmptyDescription>{t("auth.forgot.checkBody", { email })}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">{t("auth.backToLogin")}</Link>
            </Button>
          </EmptyContent>
        </Empty>

        {/* Retyping the address goes back to the form rather than adding a second
            resend button here — one cooldown, in one place. */}
        <p className="text-center text-sm leading-5 text-muted-text">
          {t("auth.forgot.wrongAddress")}{" "}
          <LinkInline asChild>
            <button type="button" onClick={() => setSubmitted(false)}>
              {t("auth.forgot.tryAnother")}
            </button>
          </LinkInline>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight text-foreground">
          {t("auth.forgot.title")}
        </h1>
        <p className="text-sm leading-5 text-muted-text">{t("auth.forgot.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPh")}
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

      <p className="text-center text-sm leading-5 text-muted-text">
        {t("auth.forgot.remember")}{" "}
        <LinkInline asChild>
          <Link href="/login">{t("auth.forgot.loginLink")}</Link>
        </LinkInline>
      </p>
    </div>
  );
}
