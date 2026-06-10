"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { validateEmail } from "@/lib/validations";
import {
  getErrorMessage,
  getRateLimitSeconds,
  isEmailNotVerified,
} from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const { login, loginLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // Set when the backend returns 403 EMAIL_NOT_VERIFIED — Phase 1 users migrate via
  // the "Forgot password" flow (sot/phase-2/week1.md § Migrasi User Phase 1).
  const [needsVerification, setNeedsVerification] = useState(false);
  const cooldown = useCooldown();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passwordErr = !password ? "Password is required" : null;
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr ?? undefined, password: passwordErr ?? undefined });
      return;
    }
    setErrors({});
    setNeedsVerification(false);
    try {
      await login({ email, password });
    } catch (err) {
      if (isEmailNotVerified(err)) {
        setNeedsVerification(true);
        return;
      }
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        toast.error("Too many attempts. Please wait before trying again.");
        return;
      }
      toast.error(getErrorMessage(err, "Login failed"));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          New to USDX?{" "}
          <Link href="/register" className="font-medium text-gold underline-offset-2 hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {needsVerification && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Your account needs verification. Reset your password via{" "}
          <Link href="/forgot-password" className="font-medium underline underline-offset-2">
            Forgot password
          </Link>{" "}
          — a link will be sent to your email.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-gold underline-offset-2 hover:underline"
            >
              Forgot password?
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
              aria-label={showPassword ? "Hide password" : "Show password"}
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
            ? `Try again in ${cooldown.remaining}s`
            : loginLoading
              ? "Logging in..."
              : "Login"}
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
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
