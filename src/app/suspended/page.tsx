"use client";

// Dedicated full-screen notice for a suspended account (USDX-205). The API
// client bridge routes here on a 403 ACCOUNT_SUSPENDED from any authenticated
// consumer call. Public route (outside the dashboard guard) so it renders after
// the session is cleared.

import Link from "next/link";
import { Ban } from "lucide-react";
import { useLang } from "@/providers/LanguageProvider";

export default function SuspendedPage() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Ban className="size-8" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t("suspended.title")}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("suspended.description")}</p>
      <Link
        href="/login"
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {t("suspended.backToLogin")}
      </Link>
    </div>
  );
}
