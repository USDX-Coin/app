"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { validatePassword, validateConfirmPassword } from "@/lib/validations";
import { getErrorMessage } from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Landing from the reset-password email link (sot/phase-2/phase2.md § Pages #6).
// Submits the new password with the token; on success the backend revokes old
// sessions, issues a new one, and the hook redirects to the dashboard (auto-login).
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const { resetPassword, resetPasswordLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("This reset link is missing its token.");
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
      toast.error(getErrorMessage(err, "Could not reset password"));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-1">Reset Password</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">New Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              className="bg-transparent dark:bg-transparent"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={errors.password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!errors.confirmPassword}
              className="bg-transparent dark:bg-transparent"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
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
          {resetPasswordLoading ? "Resetting..." : "Reset Password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary underline">
          Back to Login
        </Link>
      </p>
    </div>
  );
}
