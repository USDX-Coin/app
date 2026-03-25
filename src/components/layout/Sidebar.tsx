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

export function Sidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1 py-4", className)}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export { navItems };
