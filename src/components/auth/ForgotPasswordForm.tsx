"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateEmail } from "@/lib/validations";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import { getErrorMessage, getRateLimitSeconds } from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const { t, lang } = useLang();
  const { forgotPassword, forgotPasswordLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const cooldown = useCooldown();

  // {email} slot lets each language place the address naturally in the sentence.
  const [checkBefore, checkAfter] = t("auth.forgot.checkBody").split("{email}");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setError("");
    try {
      // Backend returns a generic 200 even for unknown emails (avoid enumeration),
      // so we always advance to the check-email screen on success.
      await forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        toast.error(t("auth.forgot.tooMany"));
        return;
      }
      toast.error(getErrorMessage(err, t("auth.forgot.failed")));
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-3xl">✉</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">{t("auth.forgot.checkTitle")}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {checkBefore}
          <strong>{email}</strong>
          {checkAfter}
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            {t("auth.backToLogin")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-1">{t("auth.forgot.title")}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t("auth.forgot.subtitle")}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.forgot.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 bg-transparent dark:bg-transparent"
            aria-invalid={!!error}
          />
          <FieldError message={error || undefined} />
        </div>

        <Button
          type="submit"
          disabled={forgotPasswordLoading || cooldown.active}
          className="w-full bg-linear-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700"
        >
          {cooldown.active
            ? t("auth.tryAgainIn", { duration: formatDuration(cooldown.remaining, lang) })
            : forgotPasswordLoading
              ? t("auth.forgot.sending")
              : t("auth.forgot.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.forgot.remember")}{" "}
        <Link href="/login" className="text-primary underline">
          {t("auth.forgot.loginLink")}
        </Link>
      </p>
    </div>
  );
}
