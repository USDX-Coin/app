"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, ArrowDownToLine, History } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/mint", label: "Mint", icon: Coins },
  { href: "/redeem", label: "Redeem", icon: ArrowDownToLine },
  { href: "/transactions", label: "Transactions", icon: History },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-border safe-area-pb">
      <div className="flex items-stretch justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 px-2 text-xs font-medium transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
