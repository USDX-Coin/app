"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/providers/LanguageProvider";
import { isApiError } from "@/lib/api/errors";

// Landing from the activation email link (sot/phase-2/phase2.md § Pages, row 3).
// Auto-calls POST /api/v2/auth/verify-email with the token from the query string;
// on success the hook issues a session and redirects to the dashboard.
export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token");
  const { t } = useLang();
  const { verifyEmail } = useAuth();
  const [failed, setFailed] = useState<{ message?: string } | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;
    verifyEmail({ token }).catch((err) => {
      // INVALID_TOKEN → standard invalid/expired copy; anything else keeps the
      // backend message so infra errors stay diagnosable.
      setFailed(
        isApiError(err) && err.code !== "INVALID_TOKEN" && err.message
          ? { message: err.message }
          : {},
      );
    });
  }, [token, verifyEmail]);

  // A missing token is derived (no setState in the effect — avoids cascading renders).
  const error = !token
    ? t("auth.verify.missingToken")
    : failed
      ? (failed.message ?? t("auth.verify.invalid"))
      : null;

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">{t("auth.verify.failedTitle")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            {t("auth.backToLogin")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <Loader2 className="mb-4 size-8 animate-spin text-primary" />
      <h1 className="text-2xl font-bold text-primary mb-2">{t("auth.verify.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("auth.verify.wait")}</p>
    </div>
  );
}
