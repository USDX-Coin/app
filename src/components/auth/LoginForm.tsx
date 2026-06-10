"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import { validateEmail } from "@/lib/validations";
import {
  getErrorMessage,
  getRateLimitSeconds,
  isAccountSuspended,
  isEmailNotVerified,
} from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const { t } = useLang();
  const { login, loginLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    const passwordErr = !password ? t("auth.login.passwordRequired") : null;
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
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        toast.error(t("auth.tooManyAttempts"));
        return;
      }
      toast.error(getErrorMessage(err, t("auth.login.failed")));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("auth.login.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.login.newTo")}{" "}
          <Link href="/register" className="font-medium text-gold underline-offset-2 hover:underline">
            {t("auth.login.createAccount")}
          </Link>
        </p>
      </div>

      {needsVerification && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {verifyBefore}
          <Link href="/forgot-password" className="font-medium underline underline-offset-2">
            {t("auth.login.forgotLinkText")}
          </Link>
          {verifyAfter}
        </div>
      )}

      {suspended && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {t("auth.login.suspended")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-gold underline-offset-2 hover:underline"
            >
              {t("auth.login.forgot")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              className="h-11 pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError message={errors.password} />
        </div>

        <Button
          type="submit"
          disabled={loginLoading || cooldown.active}
          className="brand-gradient h-11 w-full text-white hover:opacity-95"
        >
          {cooldown.active
            ? t("auth.tryAgainIn", { s: String(cooldown.remaining) })
            : loginLoading
              ? t("auth.login.submitting")
              : t("auth.login.submit")}
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t("auth.login.orContinue")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" disabled className="h-11">Google</Button>
          <Button variant="outline" disabled className="h-11">Web3 Wallet</Button>
        </div>
      </div>
    </div>
  );
}
