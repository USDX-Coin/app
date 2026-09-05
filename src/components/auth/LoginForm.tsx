"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { LinkInline } from "@/components/ui/link-inline";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import { translateValidation, validateEmail } from "@/lib/validations";
import {
  getFailureText,
  getRateLimitSeconds,
  isAccountSuspended,
  isEmailNotVerified,
  isInvalidCredentials,
} from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { login, loginLoading, resendVerification, resendVerificationLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Validators hand back i18n keys, not sentences (finding D1) — the key is
  // what we keep, so the message re-translates when the language changes.
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // Set when the backend returns 403 EMAIL_NOT_VERIFIED.
  const [needsVerification, setNeedsVerification] = useState(false);
  // 403 ACCOUNT_SUSPENDED (auth.yaml loginV2) — distinct banner, not a generic toast.
  const [suspended, setSuspended] = useState(false);
  const cooldown = useCooldown();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passwordErr = !password ? "auth.login.passwordRequired" : null;
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr ?? undefined, password: passwordErr ?? undefined });
      return;
    }
    setErrors({});
    setNeedsVerification(false);
    setSuspended(false);
    try {
      await login({ email, password });
    } catch (err) {
      if (isEmailNotVerified(err)) {
        setNeedsVerification(true);
        return;
      }
      if (isAccountSuspended(err)) {
        setSuspended(true);
        return;
      }
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        // The countdown now lives on the button itself, so the throttle needs no
        // toast of its own — two of them fired at once before (finding B11).
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        return;
      }
      // A wrong email/password pair is the one failure the user can act on, so it
      // says so. B3 banned the backend's RAW words from this toast, not the
      // reason itself — "Login gagal" alone sends people to Forgot password.
      if (isInvalidCredentials(err)) {
        toast.error(t("auth.login.invalidCredentials"));
        return;
      }
      // Never the backend's own words: a 500 used to put "boom" in this toast
      // and a dead network put "Failed to fetch" (finding B3).
      toast.error(getFailureText(t, err, "auth.login.failed"));
    }
  }

  /**
   * The verification banner carries the action, not a sentence pointing at
   * Forgot password. Self-signup users have never set a password to reset —
   * what they need is the activation mail again (Figma 31, state "belum
   * diverifikasi"). Success lands on /register/check-email, which owns the
   * cooldown and the "still nothing?" box.
   */
  async function handleResend() {
    try {
      await resendVerification({ email });
    } catch {
      // Deliberately swallowed: the check-email screen can resend again, and a
      // toast here would fire on top of the navigation.
    }
    router.push(`/register/check-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight text-foreground">
          {t("auth.login.title")}
        </h1>
        <p className="text-sm leading-5 text-muted-text">
          {t("auth.login.newTo")}{" "}
          <LinkInline asChild>
            <Link href="/register">{t("auth.login.createAccount")}</Link>
          </LinkInline>
        </p>
      </div>

      {needsVerification && (
        <Alert
          tone="warning"
          title={t("auth.login.needsVerificationTitle")}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResend}
              loading={resendVerificationLoading}
              loadingLabel={t("auth.check.sending")}
            >
              {t("auth.login.resendLink")}
            </Button>
          }
        >
          {email
            ? t("auth.login.needsVerificationBody", { email })
            : t("auth.login.needsVerificationBodyNoEmail")}
        </Alert>
      )}

      {suspended && (
        <Alert
          tone="danger"
          title={t("auth.login.suspendedTitle")}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/suspended">{t("auth.login.suspendedAction")}</Link>
            </Button>
          }
        >
          {t("auth.login.suspended")}
        </Alert>
      )}

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
            aria-invalid={!!errors.email}
            aria-describedby="email-error"
          />
          <FieldHelp id="email" error={translateValidation(t, errors.email)} />
        </Field>

        {/* "Lupa kata sandi?" sits BELOW the field, right aligned, 8 px down —
            not on the label row. `Field` has no action slot in the label line
            (noted for the component ledger), and squeezing a second control in
            there is what made the label row read as two competing labels. */}
        <div className="flex flex-col gap-2">
          <Field>
            <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t("auth.passwordPh")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby="password-error"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon"
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldHelp id="password" error={translateValidation(t, errors.password)} />
          </Field>
          <p className="text-right text-sm leading-5">
            <LinkInline asChild>
              <Link href="/forgot-password">{t("auth.login.forgot")}</Link>
            </LinkInline>
          </p>
        </div>

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          loading={loginLoading}
          loadingLabel={t("auth.login.submitting")}
          cooldownSeconds={cooldown.remaining}
          cooldownLabel={t("auth.tryAgainIn", {
            duration: formatDuration(cooldown.remaining, lang),
          })}
        >
          {t("auth.login.submit")}
        </Button>
      </form>

      {/*
       * No "ATAU LANJUTKAN DENGAN" divider and no Google / Web3 Wallet buttons.
       * They were two permanently disabled controls with no label explaining
       * why (finding F9) on the one screen with a single job. Figma 30 C weighed
       * hiding them against a "Segera hadir" badge and chose hiding: a dead
       * control on the main path is worse than a missing one, and sign-in via
       * wallet also contradicts the email-first KYC flow (USDX-153) — a wallet
       * is connected AFTER sign-in, it is not an identity. The form is ~100 px
       * shorter for it, which is what lets Login fit a 375×667 screen without
       * scrolling. When Google or wallet sign-in actually works, the buttons
       * come back as LIVE controls.
       */}
    </div>
  );
}
