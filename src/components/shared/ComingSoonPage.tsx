"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import { springSurface } from "@/lib/motion";
import { useLang } from "@/providers/LanguageProvider";

/**
 * ComingSoon — Figma section `20`, direction 3, locked 3 September 2026.
 *
 * The screen a menu shows before its feature exists. It promises a BENEFIT, not
 * a shape and never a date: "Kirim USDX semudah kirim pesan", not "fitur kirim
 * segera hadir" — the old copy repeated its own heading and told nobody
 * anything (D9). The gold pill sits in the page header, and ONLY there: it is
 * on the title line, above the fold, which is what F3 asked for. It used to be
 * repeated on the surface as well, a hundred pixels below the first one, and
 * two pills saying the same thing read as a rendering fault, not as emphasis.
 *
 * The "Sementara itu" line is the part that earns the screen its place: it says
 * what the user can already do today instead of waiting.
 *
 * One brand surface in both themes — same maroon light and dark, like the
 * balance card. That is deliberate: it is a promotional panel, not a data
 * surface, and every colour inside it is a token (`primary-foreground` is
 * `#ffffff` in both themes), so there is no hardcoded white to drift.
 */

interface ComingSoonAction {
  /** i18n key for the label. */
  labelKey: string;
  href: string;
  /** Opens in a new tab and shows the external-link glyph. */
  external?: boolean;
}

export interface ComingSoonPageProps {
  /** Breadcrumb i18n keys, same contract as `PageHeader`. */
  crumbs: string[];
  /** Page title i18n key — the sidebar/nav wording. */
  titleKey: string;
  /** Headline i18n key: the benefit, in the user's words. */
  headlineKey: string;
  /** One sentence saying what the feature will do. */
  descKey: string;
  /** What the user can do TODAY. Omitted when there is honestly nothing. */
  meanwhileKey?: string;
  primary: ComingSoonAction;
  secondary?: ComingSoonAction;
}

export function ComingSoonPage({
  crumbs,
  titleKey,
  headlineKey,
  descKey,
  meanwhileKey,
  primary,
  secondary,
}: ComingSoonPageProps) {
  const { t } = useLang();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        crumbs={crumbs}
        title={titleKey}
        badge={<Badge tone="coming-soon">{t("common.comingSoon")}</Badge>}
      />

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSurface}
        className="balance-gradient relative flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-5 self-center overflow-hidden rounded-2xl border border-primary-foreground/20 p-6 text-center md:p-12"
      >
        <img
          src="/image/balance-texture.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-20"
        />
        <img
          src="/image/balance-watermark.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-24 h-72 w-80 opacity-25"
        />

        <img
          src="/image/usdx-coin.svg"
          alt=""
          aria-hidden
          className="relative size-14 rounded-full md:size-16"
        />

        <h2 className="relative max-w-xl text-2xl leading-8 font-semibold tracking-tight text-balance text-primary-foreground md:text-3xl md:leading-10">
          {t(headlineKey)}
        </h2>
        <p className="relative max-w-xl text-sm leading-5 text-pretty text-primary-foreground/80 md:text-base md:leading-6">
          {t(descKey)}
        </p>

        {meanwhileKey && (
          <div className="relative flex max-w-lg flex-col gap-2 pt-2">
            <p className="font-mono text-xs leading-4 tracking-widest text-primary-foreground/70 uppercase">
              {t("soon.meanwhile")}
            </p>
            <p className="text-sm leading-5 text-pretty text-primary-foreground/90">
              {t(meanwhileKey)}
            </p>
          </div>
        )}

        {/* Stacked and full-width on a phone, side by side from `sm` — the
            Figma mobile board keeps both buttons at 44 px, which a row of two
            cannot hold at 343 px without truncating a label. */}
        <div className="relative flex w-full max-w-xs flex-col gap-2 pt-2 sm:max-w-none sm:flex-row sm:justify-center">
          <ActionButton action={primary} tone="solid" />
          {secondary && <ActionButton action={secondary} tone="outline" />}
        </div>
      </motion.section>
    </div>
  );
}

function ActionButton({
  action,
  tone,
}: {
  action: ComingSoonAction;
  tone: "solid" | "outline";
}) {
  const { t } = useLang();
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className={cn(
        "w-full sm:w-auto",
        tone === "solid"
          ? "border-transparent bg-primary-foreground text-primary pointer-fine:hover:bg-primary-foreground/90 active:bg-primary-foreground/80"
          : "border-primary-foreground/40 bg-transparent text-primary-foreground pointer-fine:hover:bg-primary-foreground/10 active:bg-primary-foreground/15"
      )}
    >
      <Link
        href={action.href}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noopener noreferrer" : undefined}
      >
        {t(action.labelKey)}
        {action.external && <ExternalLink />}
      </Link>
    </Button>
  );
}
