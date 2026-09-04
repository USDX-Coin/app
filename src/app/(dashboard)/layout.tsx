"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, Menu, PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLang } from "@/providers/LanguageProvider";
import { useAuthStore } from "@/stores/authStore";

function ShellSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}

// Wraps the WHOLE dashboard shell, not just the page content (USDX-396): the
// sidebar's balance card reads the connected wallet on-chain, so it needs the
// wagmi/RainbowKit context too. Still dashboard-only and still `ssr: false`, so
// auth pages keep their wallet-free bundle; `loading` keeps the same spinner the
// hydration gate already shows instead of flashing an empty shell.
const WalletProviders = dynamic(
  () => import("@/providers/WalletProviders").then((mod) => mod.WalletProviders),
  { ssr: false, loading: () => <ShellSpinner /> }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useLang();
  const { isAuthenticated, user } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopHidden, setDesktopHidden] = useState(false);

  // Detect client-side hydration without triggering cascading renders
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (hydrated && !useAuthStore.getState().isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, router]);

  if (!hydrated) return <ShellSpinner />;

  if (!isAuthenticated) return null;

  // users.name is null until KYC submit auto-sets it — fall back to email (USDX-153).
  const name = user?.name ?? user?.email ?? "";

  return (
    <WalletProviders>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        {!desktopHidden && (
          <aside className="hidden w-68 shrink-0 md:block">
            <Sidebar onCollapse={() => setDesktopHidden(true)} />
          </aside>
        )}

        {/* Floating reopen button when sidebar hidden (desktop) */}
        {desktopHidden && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("nav.expandSidebar")}
                onClick={() => setDesktopHidden(false)}
                className="absolute top-3 left-3 z-30 hidden md:flex"
              >
                <PanelLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("nav.expandSidebar")}</TooltipContent>
          </Tooltip>
        )}

        {/*
          Mobile drawer. 272 px — the same number as the desktop rail — capped at
          85 vw, which is exactly what 272 is on a 320 px phone.

          `grid-rows-1` overrides the sheet's own header/body/footer grid: the
          Sidebar already carries that split, so the drawer hands it the whole
          height in one row instead of sizing it to its content. Sizing it to its
          content is what used to clip the nav with nothing to scroll (A3).
        */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          {/* The 85 vw cap stays an arbitrary value on purpose: it is a viewport ratio,
              not a size on the spacing scale. 272 px of drawer on a 320 px phone
              would leave 48 px of overlay — too little to aim at to dismiss it. */}
          <SheetContent side="left" className="w-68 max-w-[85vw] grid-rows-1 p-0">
            <SheetTitle className="sr-only">{t("nav.menuTitle")}</SheetTitle>
            <Sidebar onNavigate={() => setMobileOpen(false)} hasOverlayClose />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar */}
          <header className="flex h-14 items-center gap-2 border-b border-border bg-sidebar px-4 md:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("nav.openMenu")}
                  onClick={() => setMobileOpen(true)}
                  className="-ml-2 shrink-0 text-muted-text"
                >
                  <Menu className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("nav.openMenu")}</TooltipContent>
            </Tooltip>
            <img src="/image/usdx-coin.svg" alt="USDX" className="size-7 shrink-0 rounded-full" />
            <span className="max-w-40 truncate text-sm font-medium text-foreground">{name}</span>
          </header>

          {/*
            One scroll area for every dashboard page (the card), with the page
            padding on the INNER wrapper instead of the scroller:

            - `min-h-full` + border-box → the wrapper is exactly the card height
              when the page is short (no phantom scrollbar) and GROWS past it when
              the page is long. Growing is what keeps a `sticky top-0` page header
              pinned over the whole scroll range — with a fixed-height (`h-full`)
              page box the header would slide out after one viewport.
            - `pb-8 md:pb-10` lives on this in-flow wrapper, so the last element of
              a long page always keeps its breathing room. Bottom padding on the
              scroll container itself is not reliably added to the scrollable
              overflow, which is why the Redeem button used to touch the edge.
            - `flex flex-col` gives pages a fill-the-card slot via `flex-1`
              (ComingSoon centers in it). Page roots that self-center with
              `mx-auto` need `w-full`, since auto cross-margins cancel stretch.
          */}
          <main className="flex-1 overflow-hidden p-3 md:p-5">
            <div className="h-full overflow-y-auto rounded-2xl bg-card">
              <div className="flex min-h-full flex-col px-5 pt-5 pb-8 md:px-6 md:pt-6 md:pb-10">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </WalletProviders>
  );
}
