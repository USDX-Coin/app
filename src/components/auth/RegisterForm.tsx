"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxField } from "@/components/ui/checkbox";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { LinkInline } from "@/components/ui/link-inline";
import { PasswordStrength } from "@/components/ui/password-strength";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/providers/LanguageProvider";
import {
  passwordScore,
  translateValidation,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validatePhone,
  PASSWORD_RULE_COUNT,
} from "@/lib/validations";
import { getFailureText, isApiError } from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Self-signup (sot/phase-2/week1.md § Self-Signup). Fields: email, password,
// confirmPassword, phone, entityType (INDIVIDUAL only in Week 1 — LEGAL_ENTITY shown
// disabled "Coming soon"), agreeToS. Name + address are collected later at KYC.
// 409 EMAIL/PHONE_ALREADY_REGISTERED map to inline field errors; 422 renders a
// form-level alert. On success the hook routes to /register/check-email.
//
// Everything in `errors` is an i18n KEY, not a sentence: the validators return
// keys (finding D1) and so do the two 409 branches, so one `translateValidation`
// at render time covers every source.
const STRENGTH_LABELS = ["auth.strength.weak", "auth.strength.medium", "auth.strength.strong"];

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

  const score = passwordScore(password);
  // 1–2 weak · 3 fair · 4 strong — the same split PasswordStrength colours by.
  const strengthLabel =
    score > 0 ? t(STRENGTH_LABELS[Math.min(Math.ceil(score / 2) - 1, 2)]) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string | undefined> = {
      email: validateEmail(email) ?? undefined,
      phone: validatePhone(phone) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
      agreeToS: agreeToS ? undefined : "auth.register.tosRequired",
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
          setErrors((prev) => ({ ...prev, email: "auth.register.emailTaken" }));
          return;
        }
        if (err.code === "PHONE_ALREADY_REGISTERED") {
          setErrors((prev) => ({ ...prev, phone: "auth.register.phoneTaken" }));
          return;
        }
        if (err.status === 422) {
          // The 422 body is written for developers; say what the user can do
          // instead of forwarding it (finding B3).
          setFormError(t("auth.register.failed"));
          return;
        }
      }
      toast.error(getFailureText(t, err, "auth.register.failed"));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("auth.register.title")}
        </h1>
        <p className="text-sm text-muted-text">
          {t("auth.register.haveAccount")}{" "}
          <LinkInline asChild>
            <Link href="/login">{t("auth.register.login")}</Link>
          </LinkInline>
        </p>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel>{t("auth.register.accountType")}</FieldLabel>
          {/* `h-auto min-h-10 flex-wrap px-3`: "Badan Usaha" (87 px) + gap + the gold
              pill (93 px) needs 188 px of content box. With the stock `px-4` that
              is EXACTLY what a 220 px button offers from `sm` up and far more than
              the 132 px each half gets at 320 px, so the pill spilled out of the
              button and pushed the document to 324 px. `px-3` buys 8 px of slack
              so the row still reads as one line on tablet and desktop, and
              `flex-wrap` drops the pill to its own line on a narrow phone instead
              of overflowing — the same answer `CardChoice` gives at narrow widths.
              The badge itself never goes away: it is what explains the dead half. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed="true"
              className="h-auto min-h-10 flex-wrap gap-x-2 gap-y-1 px-3 py-1.5 border-primary bg-primary/5 text-primary-text"
            >
              {t("auth.register.individual")}
            </Button>
            {/* Shown, not hidden: the badge is what explains why it is off (F5). */}
            <Button
              type="button"
              variant="outline"
              comingSoon
              comingSoonLabel={t("common.comingSoon")}
              className="h-auto min-h-10 flex-wrap gap-x-2 gap-y-1 px-3 py-1.5"
            >
              {t("auth.register.legalEntity")}
            </Button>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.register.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby="email-error"
          />
          <FieldHelp id="email" error={translateValidation(t, errors.email)} />
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">{t("auth.register.phone")}</FieldLabel>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("auth.register.phonePh")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={!!errors.phone}
            aria-describedby="phone-error"
          />
          <FieldHelp id="phone" error={translateValidation(t, errors.phone)} />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("auth.register.passwordPh")}
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
          {/* The rules are shown as they are met, not as a paragraph under an
              empty box — placeholder Versi 4, case 3. */}
          <PasswordStrength
            className="pt-1"
            score={score}
            total={PASSWORD_RULE_COUNT}
            label={strengthLabel}
          />
          <FieldHelp id="password" error={translateValidation(t, errors.password)} />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword">{t("auth.register.confirmPassword")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("auth.register.confirmPasswordPh")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby="confirmPassword-error"
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
          <FieldHelp
            id="confirmPassword"
            error={translateValidation(t, errors.confirmPassword)}
          />
        </Field>

        <Field>
          {/* 20 px box, 44 px target: the row grows, the control does not (E1). */}
          <CheckboxField htmlFor="agreeToS" className="text-muted-text">
            <Checkbox
              id="agreeToS"
              checked={agreeToS}
              onCheckedChange={(checked) => setAgreeToS(checked === true)}
              aria-invalid={!!errors.agreeToS}
              aria-describedby="agreeToS-error"
            />
            <span>
              {t("auth.register.agreePrefix")}{" "}
              <LinkInline href="#">{t("auth.register.tos")}</LinkInline>
            </span>
          </CheckboxField>
          <FieldHelp id="agreeToS" error={translateValidation(t, errors.agreeToS)} />
        </Field>

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          loading={registerLoading}
          loadingLabel={t("auth.register.submitting")}
        >
          {t("auth.register.submit")}
        </Button>
      </form>
    </div>
  );
}
