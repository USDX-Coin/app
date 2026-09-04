"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
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

  const score = passwordScore(password);
  const strengthLabel =
    score > 0 ? t(STRENGTH_LABELS[Math.min(Math.ceil(score / 2) - 1, 2)]) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(t("auth.reset.missingToken"));
      return;
    }
    const newErrors = {
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    try {
      await resetPassword({ token, newPassword: password, confirmNewPassword: confirmPassword });
    } catch (err) {
      // A dead link is the reason the user needs: without it they re-click the
      // same expired mail instead of asking for a new one. Our sentence, not the
      // backend's — B3 bans the raw message, not the explanation.
      if (hasErrorCode(err, "INVALID_TOKEN")) {
        toast.error(t("auth.reset.invalidToken"));
        return;
      }
      toast.error(getFailureText(t, err, "auth.reset.failed"));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t(`${copy}.title`)}
        </h1>
        <p className="text-sm text-muted-text">{t(`${copy}.subtitle`)}</p>
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

      <p className="text-center text-sm text-muted-text">
        <LinkInline asChild>
          <Link href="/login">{t("auth.backToLogin")}</Link>
        </LinkInline>
      </p>
    </div>
  );
}
