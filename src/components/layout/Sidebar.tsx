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
import { Badge } from "@/components/ui/badge";
import { cn, formatAmount } from "@/lib/utils";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useAuthStore } from "@/stores/authStore";
import { logout as revokeSession } from "@/lib/api/auth-api";
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
  /** Renders a "Coming Soon" pill; the route serves `ComingSoon`, not a form. */
  comingSoon?: boolean;
}

// Bridge and Send have no backend yet — their old UIs faked success locally
// (bridge_/send_<timestamp>, no API call), so the routes render ComingSoon.
// The nav items stay VISIBLE on purpose (PM decision, 13 Aug): they promote the
// upcoming features. The pill is what keeps that honest — it announces the
// teaser before the click, so nobody lands on ComingSoon expecting a transfer.
const transactionItems: NavItem[] = [
  { href: "/mint", labelKey: "nav.mint", icon: Coins },
  { href: "/redeem", labelKey: "nav.redeem", icon: ArrowDownToLine },
  { href: "/bridge", labelKey: "nav.bridge", icon: ArrowLeftRight, comingSoon: true },
  { href: "/send", labelKey: "nav.send", icon: ArrowUp, comingSoon: true },
];

// /kyc is intentionally not a nav item (USDX-153): users reach it via the status
// banner on /mint or the action-gate dialog, keeping the funnel KYC-driven.
const moreItems: NavItem[] = [
  { href: "/history", labelKey: "nav.history", icon: History },
  { href: "/help", labelKey: "nav.help", icon: CircleHelp },
  { href: "/support", labelKey: "nav.support", icon: Headset },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

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
      {item.comingSoon && (
        // A plain <span> (shadcn Badge renders one), so the link keeps exactly
        // one tab stop and the pill text joins its accessible name —
        // "Bridge Coming Soon, link". Colors follow the row's own state so the
        // pill stays legible on the brand gradient when the route is active.
        <Badge
          variant="outline"
          className={cn(
            "ml-auto px-1.5 py-0 text-[10px] leading-[18px]",
            active
              ? "border-white/50 bg-white/15 text-white"
              : "border-border bg-muted text-sidebar-muted"
          )}
        >
          {t("nav.soon")}
        </Badge>
      )}
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
  // Real on-chain USDX balance of the connected wallet (USDX-396). Wallets are
  // connected contextually and never auto-reconnected (WalletProviders
  // `reconnectOnMount={false}`), so "disconnected" is the normal first state —
  // the card then offers a connect action instead of printing a number.
  const balance = useWalletBalance();
  // users.name is null until KYC submit auto-sets it — fall back to email (USDX-153).
  const name = user?.name ?? user?.email ?? "";
  const currentLang = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0];

  function handleLogout() {
    // Revoke the server session first — fire-and-forget so a network failure
    // never traps the user; the token is read synchronously before the store
    // clears (USDX-166). A 401 reply just means the session was already gone.
    revokeSession().catch(() => {});
    logout();
    router.push("/login");
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-sidebar p-5 text-sidebar-foreground">
      {/* Account switcher */}
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 outline-none">
            <img src="/image/usdx-coin.svg" alt="USDX" className="size-8 rounded-full" />
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
          {/* Only the "ready" branch may print digits. Every other state prints
              an em dash + why — never 0, never a stale number (USDX-396). */}
          <div className="flex flex-col" aria-live="polite">
            {balance.balanceUsdx != null && balance.balanceUsd != null ? (
              <>
                <p className="text-base font-medium tracking-tight text-white">
                  {formatAmount(balance.balanceUsdx)} USDX
                </p>
                <p className="text-[11px] text-white/60">≈ ${formatAmount(balance.balanceUsd)}</p>
              </>
            ) : (
              <>
                <p className="text-base font-medium tracking-tight text-white">— USDX</p>
                {/* Deliberately TEXT, not a button: connect stays contextual and
                    the page chrome carries no global connect control (W2
                    principle, asserted by redeem.spec.ts). The user connects in
                    the flow that needs a wallet; the card just says why it has
                    no number to show. */}
                <p className="text-[11px] text-white/60">
                  {balance.state === "disconnected"
                    ? t("balance.connectPrompt")
                    : balance.state === "loading"
                      ? t("balance.loading")
                      : t("balance.unavailable")}
                </p>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            router.push("/mint");
            onNavigate?.();
          }}
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
