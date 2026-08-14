"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

/**
 * Sticky shell for a dashboard page heading — apply to the FIRST element inside
 * the page root so the title stays visible while the page body scrolls under it
 * (`(dashboard)/layout.tsx` owns the single scroll area).
 *
 * - `-mt-5 pt-5 md:-mt-6 md:pt-6` swallows the scroll wrapper's top padding and
 *   re-adds it inside the heading, so the opaque strip reaches the top edge of
 *   the card and nothing peeks out above the title while scrolling.
 * - `bg-card` (not a translucent/blur fill) so scrolled content is fully hidden
 *   in both light and dark themes. Horizontal padding stays on the wrapper, so
 *   no content can pass beside the heading either.
 * - `z-10` sits under popovers/dropdowns (`z-50`), above page content.
 */
export const PAGE_HEADING_STICKY =
  "sticky top-0 z-10 -mt-5 bg-card pt-5 pb-3 md:-mt-6 md:pt-6";

/** Breadcrumb + page title. `crumbs` and `title` are i18n keys. */
export function PageHeader({ crumbs, title }: { crumbs: string[]; title: string }) {
  const { t } = useLang();
  return (
    <div className={cn(PAGE_HEADING_STICKY, "flex w-full flex-col gap-2")}>
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
