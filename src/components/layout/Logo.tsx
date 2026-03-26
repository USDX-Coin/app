"use client";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/image/Logo.svg" alt="USDX" className="h-9 w-9" />
      <span className="text-xl font-bold text-primary">USDX</span>
    </div>
  );
}
