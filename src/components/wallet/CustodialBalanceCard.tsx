"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/ui/status-badge";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { formatAmount } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

/**
 * Sidebar card for the custodial wallet (USDX-566 § Beranda). Sits UNDER the
 * connected-wallet "Total Saldo" card and never replaces it: the two paths are
 * side by side by decision (custodial-wallet.md §0, "berdampingan"), and a user
 * can have both — a MetaMask balance and a custodial one are different money.
 *
 * Renders nothing for a user without a custodial wallet (`user.custodialWallet`
 * null/absent), so the sidebar of every non-custodial user is byte-identical
 * to before this card existed. Does NOT poll: waiting screens (onboarding,
 * Settings) own the poll, this card only reflects the shared query.
 *
 * Same money rule as the card above it (USDX-396): digits print only when the
 * backend gave digits; null is "—" plus why, never 0.
 */
export function CustodialBalanceCard({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLang();
  const wallet = useCustodialWallet({ poll: false });

  if (wallet.status === "none") return null;

  const active = wallet.status === "ACTIVE";
  // Why there is no number. For a non-ACTIVE wallet the status pill already
  // says it, so the line is only for an ACTIVE wallet whose balance is unknown.
  const reason = !active ? null : wallet.isLoading ? t("balance.loading") : t("balance.unavailable");

  return (
    <div
      data-slot="custodial-balance"
      data-status={wallet.status}
      className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-tight text-sidebar-muted">
          {t("wallet.sidebar.title")}
        </p>
        {!active && (
          <Badge tone={statusTone(wallet.status)} data-status={wallet.status}>
            {t(`wallet.status.${wallet.status}`)}
          </Badge>
        )}
      </div>
      <div className="flex flex-col" aria-live="polite">
        {wallet.balanceUsdx != null ? (
          <p className="text-base font-medium tracking-tight text-sidebar-foreground">
            {formatAmount(wallet.balanceUsdx)} USDX
          </p>
        ) : (
          <>
            <p className="text-base font-medium tracking-tight text-sidebar-foreground">— USDX</p>
            {reason && <p className="text-xs text-sidebar-muted">{reason}</p>}
          </>
        )}
      </div>
      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/settings" onClick={onNavigate}>
          {t("wallet.sidebar.receive")}
        </Link>
      </Button>
    </div>
  );
}
