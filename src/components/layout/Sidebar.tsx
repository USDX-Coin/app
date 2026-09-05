"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coins,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUp,
  History,
  Settings,
  ChevronDown,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MenuProfil } from "@/components/ui/menu-profil";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatAmount } from "@/lib/utils";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useAuthStore } from "@/stores/authStore";
import { logout as revokeSession } from "@/lib/api/auth-api";
import { useLang } from "@/providers/LanguageProvider";
import { useThemeSwitch } from "@/hooks/useThemeSwitch";
import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { ThemeToggle } from "./ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
//
// Bantuan and Dukungan left the nav in PR 2 (F3): both routes render ComingSoon,
// and a nav that lists four rows of which three go nowhere stops reading as
// navigation. Pengaturan stays because the account menu links to it, so the pill
// is the honest way to say what is behind it.
const moreItems: NavItem[] = [
  { href: "/history", labelKey: "nav.history", icon: History },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, comingSoon: true },
];

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const { t } = useLang();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        // 40 px tall, icon at 12, label at 36 — the same row height as a list
        // item and a menu item, so the three never look like three products.
        "flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium",
        "transition-control outline-none",
        "focus-visible:ring-2 focus-visible:ring-focus-ring",
        active
          ? "brand-gradient border border-white/80 text-primary-foreground"
          : "text-sidebar-muted pointer-fine:hover:bg-accent pointer-fine:hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{t(item.labelKey)}</span>
      {item.comingSoon && (
        // A plain <span> (Badge renders one), so the link keeps exactly one tab
        // stop and the pill text joins its accessible name — "Bridge Coming
        // Soon, link". Gold on maroon reads on the active gradient too, so the
        // pill needs no second colour branch.
        <Badge tone="coming-soon" className="ml-auto">
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
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="px-3 text-xs leading-4 font-medium tracking-wide text-sidebar-muted uppercase">
        {label}
      </p>
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

/**
 * Sidebar — 272 px wide, the same component on the desktop rail and inside the
 * mobile Sheet.
 *
 * Three rows, and the split is the whole point (A3): only the middle one
 * scrolls. Before this, the drawer was one long `overflow-y-auto` column, so on
 * a 320×568 phone the language and theme controls sat below the fold of a
 * container that could not be reached — the sheet clipped them and nothing
 * scrolled. Now the header and the footer are pinned and the nav absorbs
 * whatever height is left, which is 414 px on that phone.
 */
export function Sidebar({
  onNavigate,
  onCollapse,
  hasOverlayClose = false,
}: {
  onNavigate?: () => void;
  onCollapse?: () => void;
  /** Inside the Sheet, the drawer draws its own close button over this header. */
  hasOverlayClose?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, lang, setLang } = useLang();
  const { theme, setThemeWithTransition } = useThemeSwitch();
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
    // The three-row template stays an arbitrary value: it is a grid template, not
    // a length, and the scale has no value for "pin the ends, give the middle the
    // rest". Same shape as `ui/dialog.tsx` and `ui/sheet.tsx`.
    <div className="grid h-full w-full min-w-0 grid-rows-[auto_1fr_auto] bg-sidebar text-sidebar-foreground">
      {/* Row 1 — account switcher. Pinned. */}
      <div
        data-slot="sidebar-header"
        // `min-w-0` menanggung beban: sebagai grid item, default `min-width: auto`
        // membuat baris ini melebar mengikuti isinya alih-alih memotongnya. Akun tanpa
        // nama memakai email sebagai kedua baris, dan email 25 karakter melebarkan
        // SELURUH sidebar 272 → 349 px sehingga kartu saldo menembus area konten.
        // `truncate` di dalam MenuProfil tidak pernah aktif tanpa ini.
        className={cn("flex min-w-0 shrink-0 items-center gap-1 p-3", hasOverlayClose && "pr-12")}
      >
        <MenuProfil
          className="min-w-0 flex-1"
          name={name}
          email={user?.email ?? ""}
          kycStatus={user?.kycStatus ?? "UNVERIFIED"}
          lang={lang}
          onLangChange={(value) => setLang(value as typeof lang)}
          languages={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
          theme={theme ?? "system"}
          onThemeChange={setThemeWithTransition}
          themes={[
            { value: "light", label: t("theme.light") },
            { value: "dark", label: t("theme.dark") },
            { value: "system", label: t("theme.system") },
          ]}
          onProfile={() => {
            router.push("/profile");
            onNavigate?.();
          }}
          onSettings={() => {
            router.push("/settings");
            onNavigate?.();
          }}
          onVerify={() => {
            router.push("/kyc");
            onNavigate?.();
          }}
          onLogout={handleLogout}
        />
        {onCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("nav.collapseSidebar")}
                onClick={onCollapse}
                className="shrink-0 text-sidebar-muted"
              >
                <PanelLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("nav.collapseSidebar")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Row 2 — the only part that scrolls. `overscroll-contain` keeps a flick
          inside the drawer from scrolling the page behind it. */}
      <div
        data-slot="sidebar-nav"
        className="flex min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain px-3 pb-3"
      >
        {/* Total Saldo card */}
        <div className="balance-gradient relative flex w-full flex-col gap-3.5 overflow-hidden rounded-xl border border-white/20 p-3">
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
            className="pointer-events-none absolute -top-px -right-13 h-36 w-41 opacity-55"
          />
          <div className="relative flex flex-col gap-1">
            <p className="text-xs font-medium tracking-tight text-white/60">
              {t("sidebar.totalBalance")}
            </p>
            {/* Only the "ready" branch may print digits. Every other state prints
                an em dash + why — never 0, never a stale number (USDX-396). */}
            <div className="flex flex-col" aria-live="polite">
              {balance.balanceUsdx != null && balance.balanceUsd != null ? (
                <>
                  <p className="text-base font-medium tracking-tight text-white">
                    {formatAmount(balance.balanceUsdx)} USDX
                  </p>
                  <p className="text-xs text-white/60">≈ ${formatAmount(balance.balanceUsd)}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-medium tracking-tight text-white">— USDX</p>
                  {/* Deliberately TEXT, not a button: connect stays contextual and
                      the page chrome carries no global connect control (W2
                      principle, asserted by redeem.spec.ts). The user connects in
                      the flow that needs a wallet; the card just says why it has
                      no number to show. */}
                  <p className="text-xs text-white/60">
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
          <Button
            variant="ghost"
            onClick={() => {
              router.push("/mint");
              onNavigate?.();
            }}
            // The card owns its own dark gradient; `ghost` is only here for the
            // height, the focus ring and the press state.
            className="brand-dark-gradient relative w-full text-white pointer-fine:hover:bg-transparent"
          >
            {t("sidebar.getUsdx")}
          </Button>
        </div>

        <NavGroup
          label={t("sidebar.transaction")}
          items={transactionItems}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <NavGroup
          label={t("sidebar.more")}
          items={moreItems}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </div>

      {/* Row 3 — language and theme. Pinned, and padded past the iPhone home
          indicator; without the safe area the theme button sits under it. Height
          is `auto` on purpose — pinning it is what creates safe-area bugs. */}
      <div
        data-slot="sidebar-footer"
        className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              // Purpose AND current value: a bare "Bahasa" would OVERRIDE the
              // visible "Indonesia" and hide which language is selected — the
              // same WCAG 2.5.3 trap the account button just had. Composed, the
              // spoken name still contains the visible label.
              aria-label={`${t("sidebar.selectedLanguage")}: ${currentLang.label}`}
              className="min-w-0 flex-1 justify-start gap-2 px-3 font-normal text-sidebar-muted"
            >
              <img
                src={currentLang.flag}
                alt=""
                className="size-4 shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-left">{currentLang.label}</span>
              <ChevronDown className="size-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            <DropdownMenuRadioGroup
              value={lang}
              onValueChange={(value) => setLang(value as typeof lang)}
            >
              {LANGUAGES.map((l) => (
                <DropdownMenuRadioItem key={l.value} value={l.value}>
                  <span className="flex min-w-0 items-center gap-2">
                    <img
                      src={l.flag}
                      alt=""
                      className="size-4 shrink-0 rounded-full object-cover"
                    />
                    <span className="truncate">{l.label}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>
    </div>
  );
}

export { transactionItems, moreItems };
