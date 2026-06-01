"use client";

import { ShieldCheck, Globe, Coins } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Branding panel */}
      <div className="balance-gradient relative hidden w-[45%] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <img
          src="/image/balance-watermark.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-10 h-[520px] w-[600px] opacity-10"
        />

        <div className="relative flex items-center gap-3">
          <img src="/image/usdx-logo.png" alt="USDX" className="size-11 rounded-full" />
          <span className="text-2xl font-semibold tracking-tight">USDX</span>
        </div>

        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              The Transparent &amp; Regulated USD Stablecoin
            </h1>
            <p className="max-w-sm text-base text-white/70">
              Mint, redeem, bridge, and send USDX across 8 networks — fast, secure, and fully backed.
            </p>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0" /> Fully backed &amp; audited reserves
            </li>
            <li className="flex items-center gap-3">
              <Globe className="size-5 shrink-0" /> Multi-chain — 8 EVM networks
            </li>
            <li className="flex items-center gap-3">
              <Coins className="size-5 shrink-0" /> Mint &amp; redeem in IDR
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© 2026 USDX. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <img src="/image/usdx-logo.png" alt="USDX" className="size-9 rounded-full" />
            <span className="text-xl font-semibold tracking-tight text-foreground">USDX</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
