"use client";

import { Construction } from "lucide-react";
import { useLang } from "@/providers/LanguageProvider";

/** `titleKey` and `descKey` are i18n keys. */
export function ComingSoon({ titleKey, descKey }: { titleKey: string; descKey: string }) {
  const { t } = useLang();
  return (
    <div className="flex h-full flex-col">
      <h1 className="text-xl font-medium tracking-tight text-foreground">{t(titleKey)}</h1>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </div>
        <p className="text-base font-medium text-foreground">{t("common.comingSoon")}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{t(descKey)}</p>
      </div>
    </div>
  );
}
