"use client";

import { useState } from "react";
import Link from "next/link";
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
  const { login, loginLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Validators hand back i18n keys, not sentences (finding D1) — the key is
  // what we keep, so the message re-translates when the language changes.
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // Set when the backend returns 403 EMAIL_NOT_VERIFIED — Phase 1 users migrate via
  // the "Forgot password" flow (sot/phase-2/week1.md § Migrasi User Phase 1).
  const [needsVerification, setNeedsVerification] = useState(false);
  // 403 ACCOUNT_SUSPENDED (auth.yaml loginV2) — distinct banner, not a generic toast.
  const [suspended, setSuspended] = useState(false);
  const cooldown = useCooldown();

  // The dictionary string carries a {link} slot so each language controls the
  // sentence around the Forgot-password link.
  const [verifyBefore, verifyAfter] = t("auth.login.needsVerification").split("{link}");

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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("auth.login.title")}
        </h1>
        <p className="text-sm text-muted-text">
          {t("auth.login.newTo")}{" "}
          <LinkInline asChild>
            <Link href="/register">{t("auth.login.createAccount")}</Link>
          </LinkInline>
        </p>
      </div>

      {needsVerification && (
        <Alert tone="warning">
          {verifyBefore}
          <LinkInline asChild>
            <Link href="/forgot-password">{t("auth.login.forgotLinkText")}</Link>
          </LinkInline>
          {verifyAfter}
        </Alert>
      )}

      {suspended && <Alert tone="danger">{t("auth.login.suspended")}</Alert>}

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

        <Field>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
            <Button variant="link" size="sm" className="-mr-3" asChild>
              <Link href="/forgot-password">{t("auth.login.forgot")}</Link>
            </Button>
          </div>
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

      <div className="flex flex-col gap-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-text">
              {t("auth.login.orContinue")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" disabled>
            Google
          </Button>
          <Button variant="outline" size="lg" disabled>
            Web3 Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}
