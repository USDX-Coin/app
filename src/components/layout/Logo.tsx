"use client";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
        <span className="text-lg font-bold text-white">$</span>
      </div>
      <span className="text-xl font-bold text-primary">USDX</span>
    </div>
  );
}
