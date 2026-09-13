"use client";

import { ShieldCheck, Globe, Coins } from "lucide-react";
import { UsdxMark } from "@/components/auth/UsdxMark";
import { useLang } from "@/providers/LanguageProvider";

/**
 * Auth shell — Figma 30 A + 30 D.
 *
 * Desktop 1280×840: brand panel 576 (45 %) + form panel 704, with a 448 column
 * centred in it — `max-w-md` inside a centred flex column gives exactly the
 * 128 px gutters the board draws.
 *
 * Mobile 375×812: no brand panel. Gutter 20 (`px-5`, column 335), the coin mark
 * at y = 24, the column at y = 88, and everything TOP aligned — the desktop
 * column is vertically centred, the mobile one is not, because Register is
 * taller than the viewport and a centred short screen next to a scrolling tall
 * one reads as two different pages.
 *
 * `/suspended` (37) is deliberately NOT in this group: Figma drops the brand
 * panel there, and it lives at `app/suspended` outside the (auth) segment.
 * `components/auth/SuspendedNotice` carries its own bare shell for that reason.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Branding panel. The 45 % width stays an arbitrary value: it is a layout
          ratio between two columns and the spacing scale has no 45 %. Text here is
          white on maroon in both themes, so it deliberately ignores the tokens. */}
      <div className="balance-gradient relative hidden w-[45%] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        {/* art: ukuran mengikuti aset — the watermark is a fixed-size drawing,
            deliberately overflowing the panel, so it is sized in px not scale. */}
        <img
          src="/image/balance-watermark.svg"
          alt=""
          aria-hidden
          // Ukuran PROPORSIONAL, bukan piksel tetap. Node Figma menulis "600×520" —
          // dan itu benar UNTUK panel 576×840 di papan, tempat X menutupi 104 % lebar
          // panel. Di layar nyata panelnya ~900×1200, jadi angka px yang sama cuma
          // menutupi 67 % dan monogramnya nyaris hilang. Yang harus dipertahankan
          // adalah RASIONYA terhadap panel, bukan angkanya.
          //
          // `aspect-[600/520]` wajib: SVG-nya ditulis `width="100%" height="100%"`
          // dengan `preserveAspectRatio="none"`, jadi ia meregang mengikuti kotaknya
          // dan tanpa tinggi eksplisit ia kolaps (terukur 150 px, bukan 585).
          className="pointer-events-none absolute -top-10 -right-24 aspect-[600/520] w-[104%] max-w-none opacity-10"
        />

        <div className="relative">
          <UsdxMark tone="brand" size={44} />
        </div>

        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              {t("auth.brand.headline")}
            </h1>
            <p className="max-w-sm text-base text-white/70">{t("auth.brand.tagline")}</p>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0" /> {t("auth.brand.point1")}
            </li>
            <li className="flex items-center gap-3">
              <Globe className="size-5 shrink-0" /> {t("auth.brand.point2")}
            </li>
            <li className="flex items-center gap-3">
              <Coins className="size-5 shrink-0" /> {t("auth.brand.point3")}
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/50">{t("auth.brand.copyright")}</p>
      </div>

      {/* Form panel — gutter 20 and top aligned on mobile, 448 centred on desktop. */}
      <div className="flex flex-1 flex-col px-5 pt-6 pb-12 lg:items-center lg:justify-center lg:px-12 lg:py-12">
        <div className="mb-8 lg:hidden">
          <UsdxMark />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
