"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/providers/LanguageProvider";
import { getFailureKey, isApiError } from "@/lib/api/errors";

// Landing from the activation email link (sot/phase-2/phase2.md § Pages, row 3).
// Auto-calls POST /api/v2/auth/verify-email with the token from the query string;
// on success the hook issues a session and redirects to the dashboard.
export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token");
  const { t } = useLang();
  const { verifyEmail } = useAuth();
  // An i18n key, never the backend's own sentence: "boom" from a 500 used to be
  // printed here word for word (finding B3).
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;
    verifyEmail({ token }).catch((err) => {
      // INVALID_TOKEN → the standard invalid/expired copy. A network or server
      // failure is a different situation and says so; anything else falls back
      // to the same invalid-link copy, because that is what it looks like to
      // whoever clicked the link.
      const infra = getFailureKey(err);
      setFailedKey(
        isApiError(err) && err.code === "INVALID_TOKEN"
          ? "auth.verify.invalid"
          : (infra ?? "auth.verify.invalid"),
      );
    });
  }, [token, verifyEmail]);

  // A missing token is derived (no setState in the effect — avoids cascading renders).
  const errorKey = !token ? "auth.verify.missingToken" : failedKey;

  if (errorKey) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia kind="error">
            <CircleAlert />
          </EmptyMedia>
          {/* `as="h1"`, matching the pending branch below: the failed state was
              the one screen here with no heading at all. */}
          <EmptyTitle as="h1">{t("auth.verify.failedTitle")}</EmptyTitle>
          <EmptyDescription>{t(errorKey)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {/* A dead end needs a way out: the resend lives on /register/check-email. */}
          <Button variant="brand" size="lg" className="w-full" asChild>
            <Link href="/register/check-email">{t("auth.check.resend")}</Link>
          </Button>
          <Button variant="outline" size="lg" className="w-full" asChild>
            <Link href="/login">{t("auth.backToLogin")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Spinner className="size-8 text-primary" aria-label={t("auth.verify.wait")} />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("auth.verify.title")}
        </h1>
        <p className="text-sm text-muted-text">{t("auth.verify.wait")}</p>
      </div>
    </div>
  );
}
