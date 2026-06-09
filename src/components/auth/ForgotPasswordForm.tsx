"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateEmail } from "@/lib/validations";
import { FieldError } from "@/components/ui/field-error";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage, getRateLimitSeconds } from "@/lib/api/errors";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const { forgotPassword, forgotPasswordLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setError("");
    try {
      // Backend returns a generic 200 even for unknown emails (avoid enumeration),
      // so we always advance to the check-email screen on success.
      await forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        toast.error(
          retryAfter > 0
            ? `Please wait ${retryAfter}s before requesting another link.`
            : "Too many requests. Please try again later.",
        );
        return;
      }
      toast.error(getErrorMessage(err, "Could not send reset link"));
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-3xl">✉</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">Check Your Email</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We&apos;ve sent a password reset link to <strong>{email}</strong>
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            Back to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-1">Forgot Password</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Enter your email and we&apos;ll send you a reset link.
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
            aria-invalid={!!error}
          />
          <FieldError message={error || undefined} />
        </div>

        <Button
          type="submit"
          disabled={forgotPasswordLoading}
          className="w-full bg-linear-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700"
        >
          {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </p>
    </div>
  );
}
