"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/providers/LanguageProvider";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validatePhone,
} from "@/lib/validations";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Self-signup (sot/phase-2/week1.md § Self-Signup). Fields: email, password,
// confirmPassword, phone, entityType (INDIVIDUAL only in Week 1 — LEGAL_ENTITY shown
// disabled "Coming soon"), agreeToS. Name + address are collected later at KYC.
// 409 EMAIL/PHONE_ALREADY_REGISTERED map to inline field errors; 422 renders a
// form-level alert. On success the hook routes to /register/check-email.
export function RegisterForm() {
  const { t } = useLang();
  const { register, registerLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToS, setAgreeToS] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string | undefined> = {
      email: validateEmail(email) ?? undefined,
      phone: validatePhone(phone) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
      agreeToS: agreeToS ? undefined : t("auth.register.tosRequired"),
    };

    const hasErrors = Object.values(newErrors).some(Boolean);
    setErrors(newErrors);
    setFormError(null);
    if (hasErrors) return;

    try {
      await register({
        email,
        password,
        confirmPassword,
        phone,
        entityType: "INDIVIDUAL",
        agreeToS,
      });
    } catch (err) {
      // 409 per-field inline; 422 (e.g. ENTITY_TYPE_NOT_SUPPORTED) form-level.
      if (isApiError(err)) {
        if (err.code === "EMAIL_ALREADY_REGISTERED") {
          setErrors((prev) => ({ ...prev, email: t("auth.register.emailTaken") }));
          return;
        }
        if (err.code === "PHONE_ALREADY_REGISTERED") {
          setErrors((prev) => ({ ...prev, phone: t("auth.register.phoneTaken") }));
          return;
        }
        if (err.status === 422) {
          setFormError(err.message);
          return;
        }
      }
      toast.error(getErrorMessage(err, t("auth.register.failed")));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-1">{t("auth.register.title")}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {t("auth.register.haveAccount")}{" "}
        <Link href="/login" className="text-primary underline">
          {t("auth.register.login")}
        </Link>
      </p>

      {formError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>{t("auth.register.accountType")}</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed="true"
              className="rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm font-medium text-primary"
            >
              {t("auth.register.individual")}
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-60"
            >
              {t("auth.register.legalEntity")}
              <span className="block text-xs">({t("common.comingSoon")})</span>
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.register.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 bg-transparent dark:bg-transparent"
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>

        <div>
          <Label htmlFor="phone">{t("auth.register.phone")}</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder={t("auth.register.phonePh")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5 bg-transparent dark:bg-transparent"
            aria-invalid={!!errors.phone}
          />
          <FieldError message={errors.phone} />
        </div>

        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.register.passwordPh")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              className="bg-transparent dark:bg-transparent"
            />
            <button
              type="button"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={errors.password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword">{t("auth.register.confirmPassword")}</Label>
          <div className="relative mt-1.5">
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.register.confirmPasswordPh")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!errors.confirmPassword}
              className="bg-transparent dark:bg-transparent"
            />
            <button
              type="button"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={errors.confirmPassword} />
        </div>

        <div>
          <label htmlFor="agreeToS" className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <input
              id="agreeToS"
              type="checkbox"
              checked={agreeToS}
              onChange={(e) => setAgreeToS(e.target.checked)}
              aria-invalid={!!errors.agreeToS}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              {t("auth.register.agreePrefix")}{" "}
              <Link href="#" className="text-primary underline">
                {t("auth.register.tos")}
              </Link>
            </span>
          </label>
          <FieldError message={errors.agreeToS} />
        </div>

        <Button
          type="submit"
          className="w-full bg-linear-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700"
          disabled={registerLoading}
        >
          {registerLoading ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
      </form>
    </div>
  );
}
