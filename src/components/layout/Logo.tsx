"use client";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <img src="/image/logo-lockup.png" alt="USDX" className="h-9 w-auto" />
    </div>
  );
}
