"use client";

import { useState } from "react";
import { useSessionUser } from "@/hooks/useSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordModal } from "@/components/profile/ChangePasswordModal";
import { PAGE_HEADING_STICKY } from "@/components/shared/PageHeader";
import { useLang } from "@/providers/LanguageProvider";
import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { cn, formatDate } from "@/lib/utils";
import { ShieldCheck, Mail, User, Calendar, BadgeCheck, Globe, Lock } from "lucide-react";

// Stands in for a value still travelling from /api/v2/auth/me. The alternative —
// printing "-" or defaulting the KYC label to "Unverified" — states something about
// the customer that the app does not yet know.
function FieldSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton data-testid="profile-field-skeleton" className={cn("h-4 w-40", className)} />
  );
}

export function ProfileCard() {
  const { user, loading } = useSessionUser();
  const { t, lang } = useLang();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const kycLabel = t(`profile.kyc.${user?.kycStatus ?? "UNVERIFIED"}`);
  const activeLang = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0];

  return (
    // `w-full`: the page root is a flex item of the dashboard scroll wrapper and
    // `mx-auto` cancels the default stretch, so the column would otherwise
    // shrink to its content width.
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <h1 className={cn(PAGE_HEADING_STICKY, "text-2xl font-bold text-primary")}>
        {t("profile.title")}
      </h1>

      {/* Personal Information */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{t("profile.personalInfo")}</h2>
          {loading ? (
            <FieldSkeleton className="h-6 w-24 rounded-full" />
          ) : (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary flex items-center gap-1"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {kycLabel}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.fullName")}</p>
              {loading ? (
                <FieldSkeleton className="mt-1" />
              ) : (
                <p className="text-sm font-medium">{user?.name ?? "-"}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.email")}</p>
              {loading ? (
                <FieldSkeleton className="mt-1" />
              ) : (
                <p className="text-sm font-medium">{user?.email ?? "-"}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.memberSince")}</p>
              {loading ? (
                <FieldSkeleton className="mt-1 w-32" />
              ) : (
                <p className="text-sm font-medium">
                  {user?.createdAt ? formatDate(user.createdAt) : "-"}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <BadgeCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.kycLevel")}</p>
              {loading ? (
                <FieldSkeleton className="mt-1 w-24" />
              ) : (
                <p className="text-sm font-medium">{kycLabel}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security — only real, implemented controls (USDX-173). 2FA / Last Login /
          Login Notifications were hardcoded mock claims with no backing feature and
          were removed; they can return when they ship in the SoT roadmap. */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          {t("profile.security.title")}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t("profile.security.password")}</p>
            <p className="text-xs text-muted-foreground">
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
      </div>

      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />

      {/* Preferences — only the real, FE-backed control (USDX-177). Email
          Notifications / Currency Display / Default Network were static mock
          claims with no backing feature and were dropped; they return when a
          user-preferences backend (Email Notif needs USDX-142) or a real local
          pre-select ships. Language reflects the active LanguageProvider locale. */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t("profile.preferences.title")}
        </h2>
        <div className="flex items-start gap-3">
          <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">
              {t("profile.preferences.language")}
            </p>
            <p className="text-sm font-medium">{activeLang.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
