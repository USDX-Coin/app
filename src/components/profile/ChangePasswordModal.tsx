"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { useLang } from "@/providers/LanguageProvider";
import {
  translateValidation,
  validatePassword,
  validateConfirmPassword,
} from "@/lib/validations";
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
      new: translateValidation(t, validatePassword(newPassword)) ?? undefined,
      confirm:
        translateValidation(t, validateConfirmPassword(newPassword, confirmNewPassword)) ??
        undefined,
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
      // PASSWORD_MISMATCH / WEAK_PASSWORD — matched by code, not status: per SoT
      // these keep their own code (WEAK_PASSWORD stays 400 — conventions.md
      // § Validation Error v2 lists it under token/policy, not the generic 422
      // VALIDATION_ERROR). Client validation should catch them first anyway.
      if (hasErrorCode(err, "PASSWORD_MISMATCH")) {
        setErrors({
          confirm:
            translateValidation(t, validateConfirmPassword(newPassword, confirmNewPassword)) ??
            getErrorMessage(err),
        });
        return;
      }
      if (hasErrorCode(err, "WEAK_PASSWORD")) {
        setErrors({ new: translateValidation(t, validatePassword(newPassword)) ?? getErrorMessage(err) });
        return;
      }
      toast.error(getErrorMessage(err, t("profile.changePassword.failed")));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("profile.changePassword.title")}</DialogTitle>
        </DialogHeader>

        {/* The form wraps body AND footer so Enter still submits from any field;
            `contents` keeps it out of the dialog's three-row grid. */}
        <form onSubmit={handleSubmit} className="contents">
          <DialogBody className="gap-4">
            <DialogDescription>{t("profile.changePassword.description")}</DialogDescription>

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
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="flex-1"
              loading={changePasswordLoading}
              loadingLabel={t("profile.changePassword.submitting")}
              cooldownSeconds={cooldown.active ? cooldown.remaining : undefined}
              cooldownLabel={t("auth.tryAgainIn", {
                duration: formatDuration(cooldown.remaining, lang),
              })}
            >
              {t("profile.changePassword.submit")}
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
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={visible ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
        />
        <InputGroupAddon align="inline-end">
          {/* 40 px, 44 on touch. The eye used to be a bare 16 px icon with no
              hit area of its own — the smallest target in the product (E1). */}
          <InputGroupButton
            size="icon"
            aria-label={visible ? hideLabel : showLabel}
            onClick={onToggle}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldHelp id={id} error={error} />
    </Field>
  );
}
