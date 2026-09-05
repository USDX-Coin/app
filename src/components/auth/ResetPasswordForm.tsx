"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hourglass } from "lucide-react";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { LinkInline } from "@/components/ui/link-inline";
import { PasswordStrength } from "@/components/ui/password-strength";
import { useLang } from "@/providers/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import {
  passwordScore,
  translateValidation,
  validatePassword,
  validateConfirmPassword,
  PASSWORD_RULE_COUNT,
} from "@/lib/validations";
import { getFailureText, hasErrorCode } from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const STRENGTH_LABELS = ["auth.strength.weak", "auth.strength.medium", "auth.strength.strong"];

// Landing from BOTH email links (sot/phase-2/week1.md § Forgot Password):
// forgot-password (reset token, TTL 1h) and admin-created activation (TTL 7d).
// Copy adapts via the `type` query param (PM decision USDX-142): `type=activation`
// → invite copy ("Atur kata sandi"); absent or unknown value → default reset copy.
// The param is presentational only — token validity/TTL stays server-side.
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const isActivation = params.get("type") === "activation";
  const copy = isActivation ? "auth.activate" : "auth.reset";
  const { t } = useLang();
  const { resetPassword, resetPasswordLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // i18n keys, not sentences — see `lib/validations.ts` (finding D1).
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  // Set when the server rejects the token at submit time. Together with a
  // missing `?token=` it replaces the form entirely.
  const [tokenDead, setTokenDead] = useState(false);

  const score = passwordScore(password);
  const strengthLabel =
    score > 0 ? t(STRENGTH_LABELS[Math.min(Math.ceil(score / 2) - 1, 2)]) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors = {
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    try {
      await resetPassword({
        token: token as string,
        newPassword: password,
        confirmNewPassword: confirmPassword,
      });
    } catch (err) {
      // A dead link replaces the form; it does not toast over a form the user
      // can still submit. Re-clicking the same expired mail is exactly what the
      // old toast produced (finding B7).
      if (hasErrorCode(err, "INVALID_TOKEN")) {
        setTokenDead(true);
        return;
      }
      toast.error(getFailureText(t, err, "auth.reset.failed"));
    }
  }

  /*
   * No token, or the server refused it: the form is not rendered at all. It used
   * to render in full and stay submittable, so the only way to learn the link
   * was dead was to fill in two password fields and press the button (B7).
   */
  if (!token || tokenDead) {
    return (
      <div className="flex flex-col gap-6">
        <Empty className="gap-4 p-0">
          <EmptyHeader>
            <EmptyMedia className="bg-warning/12 text-warning-text">
              <Hourglass />
            </EmptyMedia>
            <EmptyTitle as="h1">{t("auth.reset.deadTitle")}</EmptyTitle>
            <EmptyDescription>{t("auth.reset.deadBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="brand" size="lg" asChild>
              <Link href="/forgot-password">{t("auth.reset.requestNew")}</Link>
            </Button>
          </EmptyContent>
        </Empty>

        <p className="text-center text-sm leading-5">
          <LinkInline asChild>
            <Link href="/login">{t("auth.backToLogin")}</Link>
          </LinkInline>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight text-foreground">
          {t(`${copy}.title`)}
        </h1>
        <p className="text-sm leading-5 text-muted-text">{t(`${copy}.subtitle`)}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="password">{t("auth.reset.newPassword")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("auth.reset.newPasswordPh")}
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
          <PasswordStrength
            className="pt-1"
            score={score}
            total={PASSWORD_RULE_COUNT}
            label={strengthLabel}
          />
          <FieldHelp id="password" error={translateValidation(t, errors.password)} />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword">{t("auth.reset.confirmNew")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("auth.reset.confirmNewPh")}
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

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          loading={resetPasswordLoading}
          loadingLabel={t(`${copy}.submitting`)}
        >
          {t(`${copy}.submit`)}
        </Button>
      </form>

      <p className="text-center text-sm leading-5">
        <LinkInline asChild>
          <Link href="/login">{t("auth.backToLogin")}</Link>
        </LinkInline>
      </p>
    </div>
  );
}
