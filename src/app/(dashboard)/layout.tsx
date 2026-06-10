"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, Menu, PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/authStore";

const WalletProviders = dynamic(
  () => import("@/providers/WalletProviders").then((mod) => mod.WalletProviders),
  { ssr: false }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
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

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // users.name is null until KYC submit auto-sets it — fall back to email (USDX-153).
  const name = user?.name ?? user?.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      {!desktopHidden && (
        <aside className="hidden w-[272px] shrink-0 md:block">
          <Sidebar onCollapse={() => setDesktopHidden(true)} />
        </aside>
      )}

      {/* Floating reopen button when sidebar hidden (desktop) */}
      {desktopHidden && (
        <button
          type="button"
          aria-label="Show sidebar"
          onClick={() => setDesktopHidden(false)}
          className="absolute left-3 top-3 z-30 hidden rounded-md border border-border bg-card p-2 text-muted-foreground shadow-sm hover:text-foreground md:block"
        >
          <PanelLeft className="size-5" />
        </button>
      )}

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
          <div className="flex items-center gap-2">
            <img src="/image/usdx-logo.png" alt="USDX" className="size-7 rounded-full" />
            <span className="max-w-[160px] truncate text-sm font-medium text-foreground">
              {name}
            </span>
          </div>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <main className="flex-1 overflow-hidden p-3 md:p-5">
          <div className="h-full overflow-y-auto rounded-2xl bg-card p-5 md:p-6">
            <WalletProviders>{children}</WalletProviders>
          </div>
        </main>
      </div>
    </div>
  );
}
