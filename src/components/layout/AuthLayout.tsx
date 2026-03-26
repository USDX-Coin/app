"use client";

import { Logo } from "./Logo";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Branding Panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-12 text-white">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm mb-8">
          <img src="/image/Logo.svg" alt="USDX" className="h-16 w-16" />
        </div>
        <h1 className="text-3xl font-bold mb-3">USDX</h1>
        <p className="text-lg text-white/80 text-center max-w-xs">
          USD-Backed Stablecoin
        </p>
      </div>

      {/* Form Panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12">
        <div className="lg:hidden mb-8">
          <Logo />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
