"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { getErrorMessage, getRateLimitSeconds } from "@/lib/api/errors";
import { toast } from "sonner";

// Landing after register (sot/phase-2/phase2.md § Pages #2). Prompts the user to
// check their inbox for the activation link, with a resend option (cooldown 60s).
export function CheckEmail() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const { resendVerification, resendVerificationLoading } = useAuth();
  const [sent, setSent] = useState(false);
  const cooldown = useCooldown();

  async function handleResend() {
    if (!email) {
      toast.error("Missing email address — please register again.");
      return;
    }
    try {
      await resendVerification({ email });
      setSent(true);
      cooldown.start(DEFAULT_COOLDOWN_SECONDS);
      toast.success("Verification email sent.");
    } catch (err) {
      const retryAfter = getRateLimitSeconds(err);
      if (retryAfter !== null) {
        cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
        toast.error("Too many requests. Please wait before resending.");
        return;
      }
      toast.error(getErrorMessage(err, "Could not resend email"));
    }
  }

  return (
    <div className="text-center">
      <div className="mb-4 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <span className="text-3xl">✉</span>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-primary mb-2">Verify Your Email</h1>
      <p className="text-sm text-muted-foreground mb-6">
        We&apos;ve sent a verification link to{" "}
        {email ? <strong>{email}</strong> : "your email"}. Click the link to activate
        your account.
      </p>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleResend}
        disabled={resendVerificationLoading || cooldown.active}
      >
        {cooldown.active
          ? `Resend in ${cooldown.remaining}s`
          : resendVerificationLoading
            ? "Sending..."
            : sent
              ? "Resend Again"
              : "Resend Verification"}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary underline">
          Back to Login
        </Link>
      </p>
    </div>
  );
}
