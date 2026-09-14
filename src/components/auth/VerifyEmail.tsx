"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Hourglass, LoaderCircle, MailCheck, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkInline } from "@/components/ui/link-inline";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/providers/LanguageProvider";
import { getFailureKey, getFailureText, isApiError } from "@/lib/api/errors";
import { translateValidation, validateEmail } from "@/lib/validations";
import { toast } from "sonner";

// Landing from the activation email link (sot/phase-2/phase2.md § Pages, row 3).
// Auto-calls POST /api/v2/auth/verify-email with the token from the query string;
// on success the hook issues a session and redirects to the dashboard.
//
// Figma 34 draws four states where the page used to render nothing at all
// (finding B6). They differ by what the user can DO next, which is why the dead
// link gets a resend form on this very screen instead of a link somewhere else:
//
//   memverifikasi → neutral, no controls (nothing to do)
//   berhasil      → success, "Lanjut ke aplikasi" as a fallback for the redirect
//   kedaluwarsa   → warning, email field + "Kirim tautan baru"
//   tidak valid   → danger, "Masuk" + "Belum punya akun? Daftar"
//
// The backend returns INVALID_TOKEN for an expired link and for a broken one
// alike; until it distinguishes them (TOKEN_EXPIRED, noted for the ledger) a
// server-rejected token is shown as `expired`, because that is the state with
// the useful way out. A missing token is `invalid` — the client can tell.
type State = "pending" | "done" | "expired" | "invalid" | "infra";

export function VerifyEmail() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const { t } = useLang();
  const { verifyEmail, resendVerification, resendVerificationLoading } = useAuth();
  // An i18n key, never the backend's own sentence: "boom" from a 500 used to be
  // printed here word for word (finding B3).
  const [failure, setFailure] = useState<{ state: State; key?: string } | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;
    verifyEmail({ token })
      .then(() => setFailure({ state: "done" }))
      .catch((err) => {
        const infra = getFailureKey(err);
        if (isApiError(err) && err.code === "INVALID_TOKEN") {
          setFailure({ state: "expired" });
          return;
        }
        // A dead network or a 500 is a different situation from a dead link and
        // must not offer a resend that cannot reach the server either.
        setFailure(infra ? { state: "infra", key: infra } : { state: "expired" });
      });
  }, [token, verifyEmail]);

  // A missing token is derived (no setState in the effect — avoids cascading renders).
  const state: State = !token ? "invalid" : (failure?.state ?? "pending");

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError(null);
    try {
      await resendVerification({ email });
    } catch (resendErr) {
      toast.error(getFailureText(t, resendErr, "auth.check.failed"));
      return;
    }
    router.push(`/register/check-email?email=${encodeURIComponent(email)}`);
  }

  if (state === "pending") {
    return (
      <Empty className="gap-4 p-0">
        <EmptyHeader>
          <EmptyMedia className="bg-info/12 text-info-text">
            <LoaderCircle className="animate-spin" />
          </EmptyMedia>
          <EmptyTitle as="h1">{t("auth.verify.title")}</EmptyTitle>
          <EmptyDescription>{t("auth.verify.wait")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (state === "done") {
    return (
      <Empty className="gap-4 p-0">
        <EmptyHeader>
          <EmptyMedia className="bg-success/12 text-success-text">
            <MailCheck />
          </EmptyMedia>
          <EmptyTitle as="h1">{t("auth.verify.doneTitle")}</EmptyTitle>
          <EmptyDescription>{t("auth.verify.doneBody")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {/* A fallback, not the main path: the hook already navigates. It is
              here for the tab that was in the background when it fired. */}
          <Button variant="brand" size="lg" asChild>
            <Link href="/mint">{t("auth.verify.continue")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (state === "expired") {
    return (
      <div className="flex flex-col gap-6">
        <Empty className="gap-4 p-0">
          <EmptyHeader>
            <EmptyMedia className="bg-warning/12 text-warning-text">
              <Hourglass />
            </EmptyMedia>
            <EmptyTitle as="h1">{t("auth.verify.expiredTitle")}</EmptyTitle>
            <EmptyDescription>{t("auth.verify.expiredBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>

        {/* The way out lives on this screen. The token does not carry the
            address, so the screen asks for it rather than sending the user off
            to find the resend somewhere else. */}
        <form onSubmit={handleResend} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("auth.emailPh")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError}
              aria-describedby="email-error"
            />
            <FieldHelp id="email" error={translateValidation(t, emailError)} />
          </Field>
          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            loading={resendVerificationLoading}
            loadingLabel={t("auth.check.sending")}
          >
            {t("auth.verify.resendSubmit")}
          </Button>
        </form>

        <p className="text-center text-sm leading-5">
          <LinkInline asChild>
            <Link href="/login">{t("auth.backToLogin")}</Link>
          </LinkInline>
        </p>
      </div>
    );
  }

  // invalid (no token at all) and infra (network / 5xx) share the danger tone;
  // only the sentence differs, because only the cause differs.
  return (
    <div className="flex flex-col gap-6">
      <Empty className="gap-4 p-0">
        <EmptyHeader>
          <EmptyMedia className="bg-destructive/12 text-destructive-text">
            <MailX />
          </EmptyMedia>
          <EmptyTitle as="h1">
            {state === "infra" ? t("auth.verify.failedTitle") : t("auth.verify.invalidTitle")}
          </EmptyTitle>
          <EmptyDescription>
            {state === "infra" && failure?.key
              ? t(failure.key)
              : t("auth.verify.invalidBody")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {/* "Masuk" first: an activation link is single-use, so the commonest
              reason to land here is an account that is already active. */}
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">{t("auth.verify.login")}</Link>
          </Button>
        </EmptyContent>
      </Empty>

      <p className="text-center text-sm leading-5 text-muted-text">
        {t("auth.verify.noAccount")}{" "}
        <LinkInline asChild>
          <Link href="/register">{t("auth.verify.register")}</Link>
        </LinkInline>
      </p>
    </div>
  );
}
