"use client";

import { Hourglass, LoaderCircle, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { statusTone } from "@/components/ui/status-badge";
import { ReceiveAddress } from "@/components/wallet/ReceiveAddress";
import type { CustodialWalletState } from "@/hooks/useCustodialWallet";
import { getFailureKey, isWalletServiceUnavailable } from "@/lib/api/errors";
import { formatAmount, formatDateTime } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

interface CustodialWalletPanelProps {
  wallet: CustodialWalletState;
  /** Onboarding: a "your wallet is ready" heading above the address. */
  readyHeading?: boolean;
}

/**
 * Everything a user with a custodial wallet sees, keyed on the contract's three
 * statuses plus the two the contract does not name but the screen must:
 *
 *   PROVISIONING, inside the poll window   → "being set up", the page updates itself
 *   PROVISIONING, window over              → "still being set up" + coba lagi
 *                                            (the retry is a POST — the only thing
 *                                            that refreshes the backend copy, §5.5)
 *   ACTIVE                                 → receiving address + balance
 *   SUSPENDED                              → paused by ops, no self-service way out
 *
 * The receive screen is gated on `status === "ACTIVE"`, not on "there is a
 * wallet": during PROVISIONING the address is null by contract. And the
 * balance prints digits ONLY when the backend gave digits — null is "—", never 0.
 */
export function CustodialWalletPanel({ wallet, readyHeading = false }: CustodialWalletPanelProps) {
  const { t, lang } = useLang();

  if (wallet.isLoading) {
    return (
      <div data-slot="wallet-panel" data-state="loading" className="flex flex-col gap-4">
        <Skeleton shape="block" className="size-36" />
        <SkeletonText />
      </div>
    );
  }

  if (wallet.isError && !wallet.wallet) {
    return (
      <Alert
        tone="danger"
        data-slot="wallet-panel"
        data-state="error"
        action={
          <Button variant="outline" size="sm" onClick={wallet.refetch} loading={wallet.isFetching}>
            {t("common.retry")}
          </Button>
        }
      >
        {t(getFailureKey(wallet.error) ?? "wallet.error.load")}
      </Alert>
    );
  }

  const statusBadge = (
    <Badge tone={statusTone(wallet.status)} data-status={wallet.status}>
      {t(`wallet.status.${wallet.status}`)}
    </Badge>
  );

  if (wallet.status === "SUSPENDED") {
    return (
      <div data-slot="wallet-panel" data-state="suspended" className="flex flex-col gap-3">
        {statusBadge}
        <Alert tone="danger" icon={<ShieldAlert />} title={t("wallet.suspended.title")}>
          {t("wallet.suspended.desc")}
        </Alert>
      </div>
    );
  }

  if (wallet.status === "PROVISIONING") {
    if (wallet.provisioningTimedOut) {
      const retryError = wallet.createError;
      return (
        <div data-slot="wallet-panel" data-state="provisioning-slow" className="flex flex-col gap-3">
          {statusBadge}
          <Alert
            tone="warning"
            icon={<Hourglass />}
            title={t("wallet.provisioning.slowTitle")}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={wallet.create}
                loading={wallet.createPending}
                loadingLabel={t("wallet.offer.creating")}
              >
                {t("common.retry")}
              </Button>
            }
          >
            {t("wallet.provisioning.slowDesc")}
          </Alert>
          {retryError ? (
            <Alert tone="danger">
              {t(
                isWalletServiceUnavailable(retryError)
                  ? "wallet.error.unavailable"
                  : (getFailureKey(retryError) ?? "wallet.error.create"),
              )}
            </Alert>
          ) : null}
        </div>
      );
    }
    return (
      <Empty data-slot="wallet-panel" data-state="provisioning" className="min-h-48 py-4">
        <EmptyHeader>
          <EmptyMedia className="bg-warning/12 text-warning-text">
            <LoaderCircle className="animate-spin" />
          </EmptyMedia>
          <EmptyTitle>{t("wallet.provisioning.title")}</EmptyTitle>
          <EmptyDescription>{t("wallet.provisioning.desc")}</EmptyDescription>
        </EmptyHeader>
        {statusBadge}
      </Empty>
    );
  }

  // ACTIVE — the address is non-null here by contract; the guard keeps the type
  // honest without inventing a fallback address.
  const address = wallet.wallet?.address ?? wallet.summary?.address;
  return (
    <div data-slot="wallet-panel" data-state="active" className="flex flex-col gap-5">
      {readyHeading && (
        <div className="flex flex-col gap-1">
          <h2 className="text-lg leading-7 font-semibold text-foreground">{t("wallet.ready.title")}</h2>
          <p className="text-sm leading-5 text-muted-text">{t("wallet.ready.desc")}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-text">{t("wallet.balance.title")}</span>
          {/* Only a real number prints digits (USDX-396 rule, same as the
              sidebar): null is an em dash plus why, never 0. */}
          <span
            data-slot="wallet-balance"
            data-known={wallet.balanceUsdx != null ? "true" : "false"}
            className="text-2xl font-semibold tracking-tight tabular-nums text-foreground"
            aria-live="polite"
          >
            {wallet.balanceUsdx != null ? `${formatAmount(wallet.balanceUsdx)} USDX` : "— USDX"}
          </span>
          <span className="text-xs text-muted-text">
            {wallet.balanceUsdx != null && wallet.balanceAt
              ? t("wallet.balance.asOf", { time: formatDateTime(wallet.balanceAt, lang) })
              : t("wallet.balance.unavailable")}
          </span>
        </div>
        <div className="flex flex-col items-end gap-2">
          {statusBadge}
          <Button variant="ghost" size="sm" onClick={wallet.refetch} loading={wallet.isFetching}>
            {t("wallet.balance.refresh")}
          </Button>
        </div>
      </div>

      {address && <ReceiveAddress address={address} />}

      <p className="text-xs text-muted-text">{t("wallet.managedNote")}</p>
    </div>
  );
}
