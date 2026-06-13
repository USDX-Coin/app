"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import { validatePassword, validateConfirmPassword } from "@/lib/validations";
import {
  getErrorMessage,
  getRateLimitSeconds,
  hasErrorCode,
  isInvalidCredentials,
} from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FieldErrors = { current?: string; new?: string; confirm?: string };

// In-app password change (USDX-173). Three fields with per-field show/hide,
// client validation reusing the register/reset policy, and SoT error mapping
// (auth.yaml changePasswordV2): 401 → inline on current, 429 → cooldown button,
// 400s → inline fallbacks. Success keeps the current session (no re-login).
export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const { t, lang } = useLang();
  const { changePassword, changePasswordLoading } = useAuth();
  const cooldown = useCooldown();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [errors, setErrors] = useState<FieldErrors>({});

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShow({ current: false, next: false, confirm: false });
    setErrors({});
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: FieldErrors = {
      current: currentPassword ? undefined : t("profile.changePassword.currentRequired"),
      new: validatePassword(newPassword) ?? undefined,
      confirm: validateConfirmPassword(newPassword, confirmNewPassword) ?? undefined,
    };
    if (nextErrors.current || nextErrors.new || nextErrors.confirm) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    try {
      await changePassword({ currentPassword, newPassword, confirmNewPassword });
      toast.success(t("profile.changePassword.success"));
      handleOpenChange(false);
    } catch (err) {
      // Wrong current password — inline on the field, keep the modal open and the
      // other fields intact (the session is still valid; no logout).
      if (isInvalidCredentials(err)) {
        setErrors({ current: t("profile.changePassword.currentWrong") });
        return;
      }
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        toast.error(t("auth.tooManyAttempts"));
        return;
      }
      // 400 fallbacks — client validation should catch these first.
      if (hasErrorCode(err, "PASSWORD_MISMATCH")) {
        setErrors({
          confirm:
            validateConfirmPassword(newPassword, confirmNewPassword) ?? getErrorMessage(err),
        });
        return;
      }
      if (hasErrorCode(err, "WEAK_PASSWORD")) {
        setErrors({ new: validatePassword(newPassword) ?? getErrorMessage(err) });
        return;
      }
      toast.error(getErrorMessage(err, t("profile.changePassword.failed")));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profile.changePassword.title")}</DialogTitle>
          <DialogDescription>{t("profile.changePassword.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PasswordField
            id="current-password"
            label={t("profile.changePassword.current")}
            value={currentPassword}
            onChange={setCurrentPassword}
            visible={show.current}
            onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
            error={errors.current}
            autoComplete="current-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
          />
          <PasswordField
            id="new-password"
            label={t("profile.changePassword.new")}
            value={newPassword}
            onChange={setNewPassword}
            visible={show.next}
            onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
            error={errors.new}
            autoComplete="new-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
          />
          <PasswordField
            id="confirm-new-password"
            label={t("profile.changePassword.confirm")}
            value={confirmNewPassword}
            onChange={setConfirmNewPassword}
            visible={show.confirm}
            onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
            error={errors.confirm}
            autoComplete="new-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={changePasswordLoading || cooldown.active}>
              {cooldown.active
                ? t("auth.tryAgainIn", { duration: formatDuration(cooldown.remaining, lang) })
                : changePasswordLoading
                  ? t("profile.changePassword.submitting")
                  : t("profile.changePassword.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  error?: string;
  autoComplete: string;
  showLabel: string;
  hideLabel: string;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  error,
  autoComplete,
  showLabel,
  hideLabel,
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className="h-11 pr-10"
        />
        <button
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onToggle}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}
