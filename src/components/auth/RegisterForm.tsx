"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validatePhone,
} from "@/lib/validations";
import { getErrorMessage } from "@/lib/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Self-signup (sot/phase-2/week1.md § Self-Signup). Fields: email, password,
// confirmPassword, phone, entityType (INDIVIDUAL only in Week 1), agreeToS. Name +
// address are collected later at KYC. On success the hook routes to /register/check-email.
export function RegisterForm() {
  const { register, registerLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToS, setAgreeToS] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string | undefined> = {
      email: validateEmail(email) ?? undefined,
      phone: validatePhone(phone) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
      agreeToS: agreeToS ? undefined : "You must accept the Terms of Service",
    };

    const hasErrors = Object.values(newErrors).some(Boolean);
    setErrors(newErrors);
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
      toast.error(getErrorMessage(err, "Registration failed"));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-1">Create Account</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 bg-transparent dark:bg-transparent"
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>

        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="08xx or +62xx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5 bg-transparent dark:bg-transparent"
            aria-invalid={!!errors.phone}
          />
          <FieldError message={errors.phone} />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
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
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm your password"
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
              I agree to the{" "}
              <Link href="#" className="text-primary underline">
                Terms of Service
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
          {registerLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </div>
  );
}
