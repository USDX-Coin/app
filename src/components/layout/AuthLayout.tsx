"use client";

import { ShieldCheck, Globe, Coins } from "lucide-react";
import { useLang } from "@/providers/LanguageProvider";

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
          className="pointer-events-none absolute -right-24 -top-10 h-[520px] w-[600px] opacity-10"
        />

        <div className="relative">
          <img src="/image/usdx-wordmark.png" alt="USDX" className="h-11 w-auto" />
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

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <img src="/image/usdx-wordmark.png" alt="USDX" className="h-9 w-auto" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
