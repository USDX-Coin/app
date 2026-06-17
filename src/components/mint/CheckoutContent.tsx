"use client";

// Own-hosted, refresh-safe mint checkout (USDX-202, week2.md § Halaman Checkout #3).
// Renders from GET /v2/mint/{id}: countdown, order/customer/wallet, payment-method
// selection (REQUESTED) → POST /pay → inline pay instructions + status tracker.
// Locks after a method is chosen; expired (client-side) and FAILED states handled.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCheckout } from "@/hooks/useCheckout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaymentMethodSelector } from "@/components/mint/PaymentMethodSelector";
import { MintStatusTracker } from "@/components/mint/MintStatusTracker";
import { VA_BANKS } from "@/lib/constants";
import { formatIDR, truncateAddress } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import type { MintChannelOption, MintOrderDetail, VaBank } from "@/types";

// GET may omit channels[] (OpenAPI gap) — fall back to a static list with unknown
// pgFee so the selector still renders on refresh.
function resolveChannels(order: MintOrderDetail): MintChannelOption[] {
  if (order.channels && order.channels.length) return order.channels;
  return [
    { channel: "VA", pgFeeIdr: "", banks: [...VA_BANKS] as VaBank[] },
    { channel: "QRIS", pgFeeIdr: "", banks: null },
  ];
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-5">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-foreground">{children}</span>
    </div>
  );
}

function BackToMint() {
  const { t } = useLang();
  return (
    <Link
      href="/mint"
      className="flex h-[42px] items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      {t("checkout.backToMint")}
    </Link>
  );
}

function PaymentInstructions({
  order,
  onCopy,
}: {
  order: MintOrderDetail;
  onCopy: (text: string) => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">{t("checkout.payInstruction")}</p>
      {order.paymentChannel === "VA" ? (
        <>
          {order.paymentBank && <Row label={t("checkout.va")}>{order.paymentBank}</Row>}
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted p-3">
            <span className="font-mono text-base font-semibold text-foreground">
              {order.virtualAccountNo}
            </span>
            <button
              type="button"
              onClick={() => order.virtualAccountNo && onCopy(order.virtualAccountNo)}
              aria-label={t("checkout.copy")}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Copy className="size-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-4 text-center">
          <span className="text-xs text-muted-foreground">{t("checkout.qrisScan")}</span>
          <span className="break-all font-mono text-xs text-foreground">{order.paymentUrl}</span>
          <button
            type="button"
            onClick={() => order.paymentUrl && onCopy(order.paymentUrl)}
            className="text-xs font-medium text-gold underline-offset-2 hover:underline"
          >
            {t("checkout.copy")}
          </button>
        </div>
      )}
    </div>
  );
}

export function CheckoutContent() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { order, isLoading, isError, pay, isPaying, payErrorKey, secondsLeft, isExpired } =
    useCheckout(id);

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    toast.success(t("checkout.copied"));
  }

  const showCountdown = order && !isExpired && order.status !== "COMPLETED" && order.status !== "FAILED";

  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader
        crumbs={["crumb.transaction", "nav.mint", "checkout.crumb"]}
        title="checkout.minting"
      />
      <div className="flex flex-1 justify-center overflow-y-auto pt-6">
        <div className="flex w-full max-w-[520px] flex-col gap-4">
          {isLoading ? (
            <Card>
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" /> {t("checkout.loading")}
              </div>
            </Card>
          ) : isError || !order ? (
            <Card>
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("checkout.notFound")}</p>
                <BackToMint />
              </div>
            </Card>
          ) : (
            <>
              {showCountdown && (
                <div className="rounded-lg bg-primary/5 px-4 py-2.5 text-center text-sm text-foreground">
                  {t("checkout.expiresIn")}{" "}
                  <span className="font-semibold tabular-nums">{formatCountdown(secondsLeft)}</span>
                </div>
              )}

              <Card>
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-medium text-foreground">{t("checkout.minting")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t("checkout.order")} #{order.orderNumber}
                  </p>
                </div>

                <Row label={t("checkout.totalPayment")}>
                  {formatIDR(Number(order.totalBeforePgFeeIdr))}
                </Row>
                <div className="border-t border-border" />
                <Row label={t("checkout.customer")}>{order.customerName}</Row>
                <Row label={t("checkout.recipient")}>
                  <span className="font-mono text-xs">
                    {order.chain} · {truncateAddress(order.userAddress)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(order.userAddress)}
                    aria-label={t("checkout.copy")}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </Row>

                <div className="border-t border-border" />

                {isExpired ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <p className="text-sm font-medium text-destructive">{t("checkout.expired")}</p>
                    <BackToMint />
                  </div>
                ) : order.paymentStatus === "REQUESTED" ? (
                  <PaymentMethodSelector
                    channels={resolveChannels(order)}
                    totalBeforePgFeeIdr={order.totalBeforePgFeeIdr}
                    isPaying={isPaying}
                    payErrorKey={payErrorKey}
                    onPay={(channel, bank) => {
                      pay(channel, bank).catch(() => {});
                    }}
                    onCancel={() => router.push("/mint")}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <PaymentInstructions order={order} onCopy={copy} />
                    {order.totalPayIdr && (
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                        <span className="font-medium text-foreground">{t("checkout.grandTotal")}</span>
                        <span className="font-semibold text-foreground">
                          {formatIDR(Number(order.totalPayIdr))}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border" />
                    <MintStatusTracker order={order} />
                    {order.status === "COMPLETED" && (
                      <Link
                        href="/history"
                        className="flex h-[42px] items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        {t("checkout.viewHistory")}
                      </Link>
                    )}
                  </div>
                )}

                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {t("checkout.simNotice")}
                </p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
