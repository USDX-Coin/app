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
  validateFullName,
} from "@/lib/validations";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function RegisterForm() {
  const { register, registerLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string | undefined> = {
      fullName: validateFullName(fullName) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmPassword:
        validateConfirmPassword(password, confirmPassword) ?? undefined,
    };

    const hasErrors = Object.values(newErrors).some(Boolean);
    setErrors(newErrors);
    if (hasErrors) return;

    try {
      await register({ fullName, email, password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
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
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 bg-transparent dark:bg-transparent"
            aria-invalid={!!errors.fullName}
          />
          <FieldError message={errors.fullName} />
        </div>

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
          className="w-full bg-linear-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700"
          disabled={registerLoading}
        >
          {registerLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </div>
  );
}
