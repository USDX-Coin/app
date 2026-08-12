"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/providers/LanguageProvider";
import { validatePassword, validateConfirmPassword } from "@/lib/validations";
import { getErrorMessage } from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Landing from BOTH email links (sot/phase-2/week1.md § Forgot Password):
// forgot-password (reset token, TTL 1h) and admin-created activation (TTL 7d).
// Copy adapts via the `type` query param (PM decision USDX-142): `type=activation`
// → invite copy ("Atur Password"); absent or unknown value → default reset copy.
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
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

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
      toast.error(getErrorMessage(err, t("auth.reset.failed")));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-1">{t(`${copy}.title`)}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t(`${copy}.subtitle`)}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.reset.newPasswordPh")}
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
          <Label htmlFor="confirmPassword">{t("auth.reset.confirmNew")}</Label>
          <div className="relative mt-1.5">
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.reset.confirmNewPh")}
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

        <Button
          type="submit"
          disabled={resetPasswordLoading}
          className="w-full bg-linear-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700"
        >
          {resetPasswordLoading ? t(`${copy}.submitting`) : t(`${copy}.submit`)}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </div>
  );
}
