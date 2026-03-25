"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateFullName,
} from "@/lib/validations";

export function RegisterForm() {
  const { register, registerLoading, registerError } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    } catch {
      // Error is handled by registerError
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {registerError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {registerError}
          </p>
        )}

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-600"
          disabled={registerLoading}
        >
          {registerLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </div>
  );
}
