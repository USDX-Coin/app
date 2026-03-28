"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Logo } from "@/components/layout/Logo";
import { BottomNav } from "@/components/layout/BottomNav";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/stores/authStore";
import { Loader2 } from "lucide-react";

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

  // Detect client-side hydration without triggering cascading renders
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Check auth after hydration
  useEffect(() => {
    if (hydrated && !useAuthStore.getState().isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, router]);

  // Show loading while hydrating
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 flex-col border-r border-border bg-white">
        <div className="h-16 border-b border-border flex items-center px-4">
          <Logo />
        </div>
        <Sidebar className="flex-1 px-3" />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={user?.fullName ?? "User"} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <WalletProviders>{children}</WalletProviders>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
