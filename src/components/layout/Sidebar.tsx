"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coins,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUp,
  History,
  CircleHelp,
  Headset,
  Settings,
  ChevronsUpDown,
  ChevronDown,
  PanelLeft,
  User,
  LogOut,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useLang } from "@/providers/LanguageProvider";
import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { ThemeToggle } from "./ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

const transactionItems: NavItem[] = [
  { href: "/mint", labelKey: "nav.mint", icon: Coins },
  { href: "/redeem", labelKey: "nav.redeem", icon: ArrowDownToLine },
  { href: "/bridge", labelKey: "nav.bridge", icon: ArrowLeftRight },
  { href: "/send", labelKey: "nav.send", icon: ArrowUp },
];

const moreItems: NavItem[] = [
  { href: "/transactions", labelKey: "nav.transaction", icon: History },
  { href: "/help", labelKey: "nav.help", icon: CircleHelp },
  { href: "/support", labelKey: "nav.support", icon: Headset },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

const MOCK_BALANCE = { usdx: "240,000", usd: "240,000" };

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const { t } = useLang();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md p-2.5 text-sm font-medium transition-colors",
        active
          ? "brand-gradient border border-white/80 text-white"
          : "text-sidebar-muted hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
  className = "",
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <p className="text-sm font-medium uppercase tracking-[0.7px] text-sidebar-muted">{label}</p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({
  onNavigate,
  onCollapse,
}: {
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, lang, setLang } = useLang();
  const name = user?.fullName ?? "Pranatha Widya";
  const currentLang = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0];

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-sidebar p-5 text-sidebar-foreground">
      {/* Account switcher */}
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 outline-none">
            <img src="/image/usdx-logo.png" alt="USDX" className="size-8 rounded-full" />
            <span className="max-w-[150px] truncate text-base font-medium tracking-tight">{name}</span>
            <ChevronsUpDown className="size-5 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="mr-2 size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onCollapse && (
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={onCollapse}
            className="text-sidebar-muted transition-colors hover:text-foreground"
          >
            <PanelLeft className="size-5" />
          </button>
        )}
      </div>

      {/* Total Saldo card */}
      <div className="balance-gradient relative flex w-full flex-col gap-3.5 overflow-hidden rounded-lg border border-white/20 p-3">
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
          className="pointer-events-none absolute -right-[51px] -top-px h-[143px] w-[165px] opacity-[0.55]"
        />
        <div className="relative flex flex-col gap-1">
          <p className="text-xs font-medium tracking-tight text-white/60">{t("sidebar.totalBalance")}</p>
          <div className="flex flex-col">
            <p className="text-base font-medium tracking-tight text-white">{MOCK_BALANCE.usdx} USDX</p>
            <p className="text-[11px] text-white/60">≈ ${MOCK_BALANCE.usd}</p>
          </div>
        </div>
        <button
          type="button"
          className="brand-dark-gradient relative flex h-[38px] w-full items-center justify-center rounded-lg px-4 text-sm font-medium text-white"
        >
          {t("sidebar.getUsdx")}
        </button>
      </div>

      <NavGroup label={t("sidebar.transaction")} items={transactionItems} pathname={pathname} onNavigate={onNavigate} />
      <NavGroup label={t("sidebar.more")} items={moreItems} pathname={pathname} onNavigate={onNavigate} className="flex-1" />

      {/* Language */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-sidebar-muted">{t("sidebar.selectedLanguage")}</p>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-1 items-center gap-2.5 rounded-md border border-border p-2.5 text-sm text-sidebar-muted outline-none transition-colors hover:bg-accent">
              <img src={currentLang.flag} alt="" className="size-5 shrink-0 rounded-full object-cover" />
              <span className="flex-1 text-left">{currentLang.label}</span>
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem key={l.value} onClick={() => setLang(l.value)} className="gap-2.5">
                  <img src={l.flag} alt="" className="size-5 shrink-0 rounded-full object-cover" />
                  <span className="flex-1">{l.label}</span>
                  {l.value === lang && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export { transactionItems, moreItems };
