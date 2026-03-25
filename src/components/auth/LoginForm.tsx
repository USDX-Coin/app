"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { validateEmail } from "@/lib/validations";

export function LoginForm() {
  const { login, loginLoading, loginError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passwordErr = !password ? "Password is required" : null;
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr ?? undefined, password: passwordErr ?? undefined });
      return;
    }
    setErrors({});
    try {
      await login({ email, password });
    } catch {
      // Error is handled by loginError from the hook
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-1">Welcome Back</h1>
      <p className="text-sm text-muted-foreground mb-8">
        New to USDX?{" "}
        <Link href="/register" className="text-primary underline">
          Create a Personal Account
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Your Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Your Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot Password
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}
        </div>

        {loginError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {loginError}
          </p>
        )}

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-600"
          disabled={loginLoading}
        >
          {loginLoading ? "Logging in..." : "Login"}
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">
              Or login with
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="outline" disabled className="w-full">
            Google
          </Button>
          <Button variant="outline" disabled className="w-full">
            Web3 Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}
