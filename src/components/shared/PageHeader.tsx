"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

/** Breadcrumb + page title. `crumbs` and `title` are i18n keys. */
export function PageHeader({ crumbs, title }: { crumbs: string[]; title: string }) {
  const { t } = useLang();
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-4 text-muted-foreground" />}
            <span className={cn(i === crumbs.length - 1 ? "text-foreground" : "text-muted-foreground")}>
              {t(c)}
            </span>
          </span>
        ))}
      </div>
      <h1 className="text-xl font-medium tracking-tight text-foreground">{t(title)}</h1>
    </div>
  );
}
