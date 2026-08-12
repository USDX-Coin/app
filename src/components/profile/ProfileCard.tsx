"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChangePasswordModal } from "@/components/profile/ChangePasswordModal";
import { useLang } from "@/providers/LanguageProvider";
import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { formatDate } from "@/lib/utils";
import { ShieldCheck, Mail, User, Calendar, BadgeCheck, Globe, Lock } from "lucide-react";

export function ProfileCard() {
  const user = useAuthStore((s) => s.user);
  const { t, lang } = useLang();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const kycLabel = t(`profile.kyc.${user?.kycStatus ?? "UNVERIFIED"}`);
  const activeLang = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-primary">{t("profile.title")}</h1>

      {/* Personal Information */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{t("profile.personalInfo")}</h2>
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary flex items-center gap-1"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {kycLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.fullName")}</p>
              <p className="text-sm font-medium">{user?.name ?? "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.email")}</p>
              <p className="text-sm font-medium">{user?.email ?? "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.memberSince")}</p>
              <p className="text-sm font-medium">
                {user?.createdAt ? formatDate(user.createdAt) : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <BadgeCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.kycLevel")}</p>
              <p className="text-sm font-medium">{kycLabel}</p>
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
