"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useSession } from "@/hooks/useSession";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/components/ui/status-badge";
import { ChangePasswordModal } from "@/components/profile/ChangePasswordModal";
import { ProfileCardSkeleton } from "@/components/profile/ProfileCardSkeleton";
import { PAGE_HEADING_STICKY } from "@/components/shared/PageHeader";
import { useLang } from "@/providers/LanguageProvider";
import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { cn, formatDate } from "@/lib/utils";
import { Mail, User, Calendar, BadgeCheck, Globe, Lock, WifiOff } from "lucide-react";

export function ProfileCard() {
  const user = useAuthStore((s) => s.user);
  const { t, lang } = useLang();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  // B10: /auth/me used to fail silently — the page kept rendering whatever
  // localStorage still held, so stale and fresh looked identical. The query is
  // read here (not just fired) so the three outcomes can be told apart:
  // nothing cached + loading -> skeleton, nothing cached + failed -> Empty,
  // cached + failed -> the data stays with a strip saying it may be stale.
  const session = useSession();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  const kycStatus = user?.kycStatus ?? "UNVERIFIED";
  const kycLabel = t(`profile.kyc.${kycStatus}`);
  const activeLang = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0];

  if (!user && session.isLoading) return <ProfileCardSkeleton />;

  if (!user && session.isError) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className={cn(PAGE_HEADING_STICKY, "text-2xl font-bold text-primary-text")}>
          {t("profile.title")}
        </h1>
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia kind={offline ? "offline" : "error"}>
                {offline ? <WifiOff /> : <BadgeCheck />}
              </EmptyMedia>
              <EmptyTitle>{t(offline ? "state.offline.title" : "profile.loadFailed.title")}</EmptyTitle>
              <EmptyDescription>
                {t(offline ? "state.offline.desc" : "profile.loadFailed.desc")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => session.refetch()} loading={session.isFetching}>
                {t("common.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    // `w-full`: the page root is a flex item of the dashboard scroll wrapper and
    // `mx-auto` cancels the default stretch, so the column would otherwise
    // shrink to its content width.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className={cn(PAGE_HEADING_STICKY, "flex items-center gap-2 text-2xl font-bold text-primary-text")}>
        {t("profile.title")}
        {/* Background refetch: 14 px, next to the title, so a slow /auth/me is
            visible without the cached data flashing away (B12). */}
        {session.isFetching && !session.isLoading && (
          <Spinner className="size-3.5 text-muted-text" aria-label={t("common.refreshing")} />
        )}
      </h1>

      {session.isError && (
        <Alert
          tone="warning"
          shape="strip"
          action={
            <Button variant="outline" size="sm" onClick={() => session.refetch()} loading={session.isFetching}>
              {t("common.retry")}
            </Button>
          }
        >
          {t(offline ? "profile.staleOffline" : "profile.stale")}
        </Alert>
      )}

      {/* Personal Information */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-base font-semibold">{t("profile.personalInfo")}</h2>
          {/* `Badge` + `statusTone()` rather than `StatusBadge`: that wrapper
              computes to 0 px wide — see the note in TransactionList.tsx. */}
          <Badge tone={statusTone(kycStatus)} data-status={kycStatus}>
            {kycLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-text mt-0.5" />
            <div>
              <p className="text-xs text-muted-text">{t("profile.fullName")}</p>
              <p className="text-sm font-medium">{user?.name ?? "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-text mt-0.5" />
            <div>
              <p className="text-xs text-muted-text">{t("profile.email")}</p>
              <p className="text-sm font-medium">{user?.email ?? "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-muted-text mt-0.5" />
            <div>
              <p className="text-xs text-muted-text">{t("profile.memberSince")}</p>
              <p className="text-sm font-medium">
                {user?.createdAt ? formatDate(user.createdAt, lang) : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <BadgeCheck className="h-4 w-4 text-muted-text mt-0.5" />
            <div>
              <p className="text-xs text-muted-text">{t("profile.kycLevel")}</p>
              <p className="text-sm font-medium">{kycLabel}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Security — only real, implemented controls (USDX-173). 2FA / Last Login /
          Login Notifications were hardcoded mock claims with no backing feature and
          were removed; they can return when they ship in the SoT roadmap. */}
      <Card>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4" />
          {t("profile.security.title")}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t("profile.security.password")}</p>
            <p className="text-xs text-muted-text">
              {t("profile.security.passwordDesc")}
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setChangePasswordOpen(true)}
          >
            {t("profile.security.changePassword")}
          </Button>
        </div>
      </Card>

      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />

      {/* Preferences — only the real, FE-backed control (USDX-177). Email
          Notifications / Currency Display / Default Network were static mock
          claims with no backing feature and were dropped; they return when a
          user-preferences backend (Email Notif needs USDX-142) or a real local
          pre-select ships. Language reflects the active LanguageProvider locale. */}
      <Card>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t("profile.preferences.title")}
        </h2>
        <div className="flex items-start gap-3">
          <Globe className="h-4 w-4 text-muted-text mt-0.5" />
          <div>
            <p className="text-xs text-muted-text">
              {t("profile.preferences.language")}
            </p>
            <p className="text-sm font-medium">{activeLang.label}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
