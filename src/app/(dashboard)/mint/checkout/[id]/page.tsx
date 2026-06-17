"use client";

// Own-hosted checkout placeholder (USDX-201). The mint form redirects here after
// POST /v2/mint. The full refresh-safe checkout — payment method (VA/QRIS),
// service fee, pay instructions, and the 3-dimension status tracker — lands in
// USDX-202. For now this proves the order exists (GET /v2/mint/{id}) and shows
// the order number + total.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getMintOrder } from "@/lib/api/mint-api";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatIDR, truncateAddress } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function MintCheckoutPage() {
  const { t } = useLang();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["mint-order", id],
    queryFn: () => getMintOrder(id),
    enabled: Boolean(id),
    retry: false,
  });

  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={["crumb.transaction", "nav.mint", "checkout.crumb"]} title="checkout.title" />
      <div className="flex flex-1 justify-center pt-8">
        <div className="flex w-full max-w-[500px] flex-col gap-4 rounded-xl border border-border bg-card p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> {t("checkout.loading")}
            </div>
          ) : isError || !order ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("checkout.notFound")}</p>
              <Link
                href="/mint"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                {t("checkout.backToMint")}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-medium text-foreground">{t("checkout.title")}</h2>
              <div className="flex flex-col gap-3">
                <Row label={t("checkout.order")} value={`#${order.orderNumber}`} />
                <Row label={t("checkout.recipient")} value={truncateAddress(order.userAddress)} />
                <Row
                  label={t("checkout.totalPayment")}
                  value={formatIDR(Number(order.totalBeforePgFeeIdr))}
                />
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {t("checkout.trackerSoon")}
              </div>
              <Link
                href="/mint"
                className="flex h-[42px] items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {t("checkout.backToMint")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
