"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api/errors";

// Landing from the activation email link (sot/phase-2/phase2.md § Pages #3).
// Auto-calls POST /api/v2/auth/verify-email with the token from the query string;
// on success the hook issues a session and redirects to the dashboard.
export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token");
  const { verifyEmail } = useAuth();
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const attempted = useRef(false);

  // A missing token is derived (no setState in the effect — avoids cascading renders).
  const error = !token ? "This verification link is missing its token." : asyncError;

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;
    verifyEmail({ token }).catch((err) => {
      setAsyncError(getErrorMessage(err, "This verification link is invalid or has expired."));
    });
  }, [token, verifyEmail]);

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">Verification Failed</h1>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            Back to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <Loader2 className="mb-4 size-8 animate-spin text-primary" />
      <h1 className="text-2xl font-bold text-primary mb-2">Verifying Your Email</h1>
      <p className="text-sm text-muted-foreground">Please wait a moment…</p>
    </div>
  );
}
