"use client";

// A7 — /halaman-ngawur used to render Next.js's stock "404 · This page could
// not be found": English, no logo, no layout, no way out. This one is the
// app's own surface and always offers two exits, one of which works whether or
// not there is a session (`/mint` is guarded and bounces to `/login`).
//
// It lives at the app root, outside `(auth)` and `(dashboard)`, so it is the
// answer for every unmatched path in both groups; that also means it renders
// without a shell and has to carry its own centering.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useLang } from "@/providers/LanguageProvider";

export default function NotFound() {
  const { t } = useLang();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 md:p-6">
      <Card className="w-full max-w-lg">
        <Empty>
          <EmptyHeader>
            {/* The coin, not the wordmark: it is the one mark that reads on
                every surface and in both themes. */}
            <img src="/image/usdx-coin.svg" alt="USDX" className="mb-2 size-12 rounded-full" />
            <EmptyMedia kind="empty">
              <Compass />
            </EmptyMedia>
            {/* `as="h1"`: this Empty IS the page, so its title has to be the page
                heading — as a <div> the route had no h1/h2/h3 at all. */}
            <EmptyTitle as="h1">{t("notFound.title")}</EmptyTitle>
            <EmptyDescription>{t("notFound.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="sm:flex-row sm:justify-center">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/mint">{t("notFound.home")}</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.back()}
            >
              <ArrowLeft />
              {t("notFound.back")}
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </div>
  );
}
