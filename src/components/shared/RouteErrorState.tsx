"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useLang } from "@/providers/LanguageProvider";

/**
 * The surface every `error.tsx` under `(dashboard)` renders — one shape for the
 * five of them so a crash on Mint and a crash on Riwayat do not read as two
 * different products.
 *
 * Two things changed from what was there before: the copy is Indonesian and
 * comes from `t()` (it was hardcoded English), and `error.message` is no longer
 * printed. That message is whatever the exception carried — "boom", "Failed to
 * fetch", a stack frame — and it tells the user nothing while telling everyone
 * else too much (B3). It stays in the console, where it is useful.
 */
export function RouteErrorState({
  titleKey,
  descKey,
  reset,
}: {
  titleKey: string;
  descKey: string;
  reset: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex w-full flex-1 items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia kind="error">
            <RotateCcw />
          </EmptyMedia>
          {/* `as="h1"`: this surface REPLACES the page, and without `PageHeader`
              none of the five error routes had a heading at all. */}
          <EmptyTitle as="h1">{t(titleKey)}</EmptyTitle>
          <EmptyDescription>{t(descKey)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={reset}>
            {t("common.retry")}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
