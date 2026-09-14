"use client";

// Redeem status tracker (USDX-243, hardened USDX-259). Polls GET /v2/redeem/{id}
// and walks the lifecycle AWAITING_BURN → BURNED → PROCESSING_PAYOUT →
// PAYOUT_COMPLETE (or EXPIRED). While AWAITING_BURN it hosts the burn action —
// for the fresh-create flow and the resume-from-/history flow (reconnect wallet,
// then burn). Both now start from the same explicit confirmation of the payout
// destination (USDX-661, below). The burn is guarded against double-submit and
// bound to the order's wallet (week3.md § Guard double-burn / Resume). Links the
// burn tx to the explorer, counts down the burn window, surfaces the optimistic
// "memproses burn" state + the stale-burn hold, and shows the simulation notice.
//
// USDX-661 (bni-integration.md § 17.12): while AWAITING_BURN on the SELF_SIGN path
// the screen first states the destination from the ORDER RESPONSE — bank · account
// number · holder name — and asks for an explicit agreement as a step of its own.
// Until it is given the burn button is disabled. This is the only point where "a
// mistyped number that happens to be valid and belongs to someone else" can still
// be caught for free.
//
// USDX-672: that name is only called the BANK's answer when the order says
// `bankAccountNameVerified: true`. The backend falls back to the name the customer
// typed when the provider answers no name (`inquiry.accountName ??
// bank.bankAccountName`), so captioning it "the bank's answer" unconditionally would
// hand out false confidence exactly where the screen is supposed to catch a mistake.
// `false` and a missing field are read the same way: show the name, claim nothing
// about where it came from, and still require the agreement.
//
// USDX-683: the "simulation mode" notice is no longer a build-time guess. It is
// posted from `redeemPayoutSimulated` in GET /api/v2/config — the backend is the
// only party that knows whether the IDR payout really leaves through a provider.
// Not known yet (loading / failed / field not shipped) shows NOTHING.
//
// USDX-664: PAYOUT_FAILED is not one of the STEPS. It gets a state of its own
// (replacing the stepper) so the journey never renders with no step active.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxField } from "@/components/ui/checkbox";
import { LinkInline } from "@/components/ui/link-inline";
import { Spinner } from "@/components/ui/spinner";
import { useRedeemStore } from "@/stores/redeemStore";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useRedeemTracker } from "@/hooks/useRedeemTracker";
import { useRedeemPreconditions } from "@/lib/redeem/wallet";
import { useRedeemBurn } from "@/hooks/useRedeemBurn";
import {
  burnDisabled,
  destinationConfirmRequired,
  orderDestination,
} from "@/lib/redeem/destination";
import { useLang } from "@/providers/LanguageProvider";
import { cn, formatAmount, formatIDR, truncateAddress } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { REDEEM_CHAIN_ID } from "@/lib/constants";
import { env } from "@/lib/env";
import type { RedeemOrderDetail, RedeemStatus as RedeemStatusEnum } from "@/types";

const STEPS: { key: RedeemStatusEnum; label: string; desc: string }[] = [
  { key: "AWAITING_BURN", label: "redeem.statusAwaitingBurn", desc: "redeem.statusAwaitingBurnDesc" },
  { key: "BURNED", label: "redeem.statusBurned", desc: "redeem.statusBurnedDesc" },
  { key: "PROCESSING_PAYOUT", label: "redeem.statusProcessing", desc: "redeem.statusProcessingDesc" },
  { key: "PAYOUT_COMPLETE", label: "redeem.statusComplete", desc: "redeem.statusCompleteDesc" },
];

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function RedeemStatus() {
  const { t } = useLang();
  const router = useRouter();
  const orderId = useRedeemStore((s) => s.orderId);
  const reset = useRedeemStore((s) => s.reset);
  const { data: order, isLoading } = useRedeemTracker(orderId);
  // Apakah pencairan rupiah di lingkungan ini disimulasikan — dijawab BACKEND
  // (USDX-683). `null` = belum diketahui; lihat spanduknya di bawah.
  const { redeemPayoutSimulated } = useAppConfig();

  // Preconditions + burn action (hooks must run before any early return). The
  // amount is 0 until the order loads — preconditions stay inert until then.
  const amountUsdx = order ? Number(order.amount) : 0;
  const pre = useRedeemPreconditions(amountUsdx);
  const { runBurn, burnState, burnErrorKey } = useRedeemBurn();

  // Persetujuan tujuan (USDX-661) disimpan sebagai id order yang disetujui, bukan
  // boolean: order lain yang dibuka di komponen yang sama (resume dari /history)
  // karena itu tidak pernah mewarisi persetujuan order sebelumnya.
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  // Tick once a second so the burn-window countdown stays live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const chain = getChainById(REDEEM_CHAIN_ID);

  if (!order || isLoading) {
    return (
      <div className="flex w-full max-w-lg items-center justify-center rounded-2xl border border-border bg-card p-10">
        <Spinner className="size-6 text-primary" aria-label={t("common.processing")} />
      </div>
    );
  }

  const isExpired = order.status === "EXPIRED";
  // Pencairan ditolak provider secara definitif (USDX-664, common.yaml §
  // RedeemStatus): keadaan tersendiri, bukan langkah keempat yang gagal.
  const isPayoutFailed = order.status === "PAYOUT_FAILED";
  // Jalur CUSTODIAL (redeem.yaml § burnMode, USDX-567): sistem yang membakar.
  // Tidak ada BurnGate (connect / tanda tangan / burn-tx), dan langkah pertama
  // berkata "sistem memproses", bukan "tanda tangani di wallet".
  const isCustodialBurn = order.burnMode === "CUSTODIAL";
  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  // Optimistically broadcast/reported but not yet confirmed by the scanner. Read
  // here too (not only inside BurnGate): once a burn is in flight the destination
  // has already been agreed to, so the confirmation step comes down.
  const burnInFlight =
    burnState === "submitting" || burnState === "submitted" || order.burnSubmittedAt != null;
  // Tujuan dari RESPONSE ORDER, bukan state form (USDX-661); `accountNameVerified`
  // menentukan apakah namanya boleh disebut jawaban bank (USDX-672).
  const destination = orderDestination(order);
  const confirmRequired = destinationConfirmRequired(order, burnInFlight);
  const destinationConfirmed = confirmedOrderId === order.id;
  const remainingSec =
    order.status === "AWAITING_BURN"
      ? (new Date(order.expiresAt).getTime() - now) / 1000
      : 0;

  return (
    <div className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-text">
          {order.orderNumber}
          {order.lateBurn && <span className="ml-2 text-warning-text">{t("redeem.lateBurn")}</span>}
        </p>
      </div>

      {/* Spanduk "mode simulasi" (USDX-683, app-config.yaml §
          AppConfig.redeemPayoutSimulated). Yang menjawab BACKEND — hanya ia yang
          tahu adapter disbursement mana yang hidup. Sebelumnya klien menebaknya
          dari flag build-time yang default menyala, jadi spanduk ini tetap
          terpasang setelah pencairan DurianPay nyata menyala: berbohong tepat di
          layar yang dipakai membuktikan pencairannya nyata.
          `null` (config masih dimuat, gagal, atau backend belum mengirim
          field-nya) → TIDAK menampilkan apa pun: menyatakan "disimulasikan"
          tanpa tahu lebih buruk daripada diam, karena diam tidak mengklaim apa
          pun. `env.useMock` tetap pemicu TERPISAH — itu soal lapisan mock klien,
          bukan adapter backend; keduanya cuma berbagi kalimat. */}
      {(env.useMock || redeemPayoutSimulated === true) && (
        <Alert tone="info" shape="strip" data-testid="redeem-simulation-notice">
          {t("redeem.simulationNotice")}
        </Alert>
      )}

      {/* Stale burn: burned past the late-burn grace → payout held for manual
          reconcile (week3.md § Late-burn cutoff, USDX-259). */}
      {order.staleBurn && (
        <Alert tone="warning" shape="strip">
          {t("redeem.staleBurn")}
        </Alert>
      )}

      {/* Pencairan bermasalah (USDX-664, § 17.2): keadaan tersendiri yang
          MENGGANTIKAN stepper — status ini bukan salah satu STEPS, dan sebuah
          perjalanan tanpa satu pun langkah aktif adalah layar yang diam. Nada
          peringatan, bukan galat merah: uangnya tidak hilang, ia menunggu orang.
          Tidak ada tombol coba lagi — nasabah tidak bisa memperbaikinya sendiri. */}
      {isPayoutFailed ? (
        <Alert
          tone="warning"
          title={t("redeem.statusPayoutFailed")}
          data-testid="redeem-payout-failed"
        >
          {t("redeem.statusPayoutFailedDesc")}
        </Alert>
      ) : (
        /* Lifecycle stepper (USDX-243) */
        <div className="flex flex-col">
          {STEPS.map((step, i) => {
            const done = !isExpired && (order.status === "PAYOUT_COMPLETE" || i < currentIndex);
            const active = !isExpired && i === currentIndex && order.status !== "PAYOUT_COMPLETE";
            const failed = isExpired && i === 0;
            const isLast = i === STEPS.length - 1;
            return (
              <div key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border",
                      done && "border-primary bg-primary text-primary-foreground",
                      active && "border-primary text-primary",
                      failed && "border-destructive bg-destructive text-destructive-foreground",
                      !done && !active && !failed && "border-border text-muted-text",
                    )}
                  >
                    {done ? (
                      <Check className="size-4" />
                    ) : active ? (
                      <Spinner className="size-4" />
                    ) : failed ? (
                      <X className="size-4" />
                    ) : (
                      <span className="text-xs">{i + 1}</span>
                    )}
                  </span>
                  {!isLast && (
                    <span className={cn("w-px flex-1 grow", done ? "bg-primary" : "bg-border")} style={{ minHeight: 28 }} />
                  )}
                </div>
                <div className={cn("flex flex-col pb-5", isLast && "pb-0")}>
                  <span className={cn("text-sm font-medium", active || done ? "text-foreground" : "text-muted-text")}>
                    {t(failed ? "redeem.statusExpired" : step.label)}
                  </span>
                  <span className="text-xs text-muted-text">
                    {t(
                      failed
                        ? "redeem.statusExpiredDesc"
                        : isCustodialBurn && step.key === "AWAITING_BURN"
                          ? "redeem.statusAwaitingBurnCustodialDesc"
                          : step.desc,
                    )}
                  </span>
                  {active && step.key === "AWAITING_BURN" && remainingSec > 0 && (
                    <span className="mt-1 text-xs text-warning-text">
                      {t("redeem.expiresIn", { time: formatMMSS(remainingSec) })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custodial: no wallet action at all — the dispatcher signs; the tracker
          just says so until the scanner confirms (custodial-wallet.md §5.3). */}
      {order.status === "AWAITING_BURN" && isCustodialBurn && (
        <p
          className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-foreground"
          data-testid="redeem-custodial-processing"
        >
          <Spinner className="shrink-0 text-primary" />
          {t("redeem.custodialBurnProcessing")}
        </p>
      )}

      {/* Konfirmasi tujuan sebelum burn (USDX-661, § 17.12). Jeda yang disengaja
          sebelum satu-satunya aksi yang tidak bisa dibatalkan di app ini: tujuan
          dibacakan dari response order — termasuk NAMA PEMILIK, dengan keterangan
          apakah nama itu jawaban bank atau belum terkonfirmasi (USDX-672) — dan nama
          itu diulang di kalimat persetujuannya, supaya centangnya tidak bisa
          diberikan tanpa membaca ke rekening siapa rupiahnya pergi. */}
      {confirmRequired && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-border p-4"
          data-testid="redeem-confirm-destination"
        >
          <p className="text-sm font-medium text-foreground">{t("redeem.confirmDestTitle")}</p>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-text">{t("sum.bankDestination")}</span>
              <span className="font-medium text-foreground">{destination.bankName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-text">{t("redeem.accountNumber")}</span>
              <span className="font-medium text-foreground">{destination.accountNumber}</span>
            </div>
            {/* Nama pemilik dapat satu baris penuh, bukan nilai di ujung kanan:
                ini satu-satunya isi layar ini yang benar-benar harus dibaca. */}
            <div className="flex flex-col gap-0.5 border-t border-border pt-2">
              <span className="text-muted-text">{t("sum.accountName")}</span>
              <span
                className="text-base leading-6 font-semibold text-foreground"
                data-testid="redeem-destination-name"
              >
                {destination.accountName}
              </span>
              {/* Keterangan asal nama (USDX-672). Klaim "jawaban bank" hanya
                  dipasang kalau order menyatakannya terverifikasi; `false` dan field
                  yang belum dikirim backend sama-sama jatuh ke kalimat yang tidak
                  mengklaim apa pun — dan menyuruh nasabah memeriksa sendiri, karena
                  di situlah satu-satunya pemeriksaan yang tersisa. */}
              <span
                className="text-xs text-muted-text"
                data-testid="redeem-destination-name-note"
              >
                {!destination.accountNameKnown
                  ? t("redeem.confirmDestNameMissing")
                  : destination.accountNameVerified
                    ? t("redeem.confirmDestNameSource")
                    : t("redeem.confirmDestNameUnverified")}
              </span>
            </div>
          </div>

          <p className="flex items-start gap-2 text-sm leading-5 text-warning-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {t("redeem.confirmDestWarning")}
          </p>

          <CheckboxField
            htmlFor="redeem-destination-confirm"
            className="items-start gap-3 border-t border-border pt-1"
          >
            <Checkbox
              id="redeem-destination-confirm"
              className="mt-2.5"
              checked={destinationConfirmed}
              onCheckedChange={(checked) => setConfirmedOrderId(checked ? order.id : null)}
            />
            <span className="py-2 text-foreground">
              {destination.accountNameKnown
                ? t("redeem.confirmDestCheck", { name: destination.accountName })
                : t("redeem.confirmDestCheckNoName")}
            </span>
          </CheckboxField>
        </div>
      )}

      {/* Burn action gate — only while awaiting the on-chain burn (USDX-259),
          and only for SELF_SIGN orders. */}
      {order.status === "AWAITING_BURN" && !isCustodialBurn && (
        <BurnGate
          order={order}
          pre={pre}
          burnState={burnState}
          burnErrorKey={burnErrorKey}
          burnInFlight={burnInFlight}
          // Persetujuan tujuan hanya menggerbangi selama masih diminta (USDX-661):
          // begitu burn berjalan, gerbangnya tidak lagi relevan.
          destinationConfirmed={destinationConfirmed || !confirmRequired}
          onBurn={() => runBurn(order, pre.address ?? "")}
        />
      )}

      {/* Burn tx + payout summary */}
      <div className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-text">{t("sum.youWillRedeem")}</span>
          <span className="font-medium text-foreground">{formatAmount(Number(order.amount))} USDX</span>
        </div>
        {/* Tujuan disebut SEKALI per layar: selagi blok konfirmasi di atas masih
            tampil, ia yang menyebutkannya (USDX-661). */}
        {!confirmRequired && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-text">{t("sum.bankDestination")}</span>
            <span className="font-medium text-foreground">
              {destination.bankName} · {destination.accountNumber}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-text">{t("redeem.netPayout")}</span>
          <span className="font-semibold text-foreground">{formatIDR(Number(order.netPayoutIdr))}</span>
        </div>
        {order.burnTxHash && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <span className="text-muted-text">{t("redeem.burnTx")}</span>
            <LinkInline
              href={chain ? `${chain.explorerUrl}/tx/${order.burnTxHash}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-medium"
            >
              {truncateAddress(order.burnTxHash, 6)}
              <ExternalLink className="size-3.5" />
            </LinkInline>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={reset}>
          {t("btn.backToRedeem")}
        </Button>
        <Button
          type="button"
          variant="brand"
          size="lg"
          className="flex-1"
          onClick={() => router.push("/history")}
        >
          {t("btn.viewHistory")}
        </Button>
      </div>
    </div>
  );
}

// Burn action while AWAITING_BURN. Resolves the precondition + guard state and
// renders exactly one affordance: processing → connect → wallet-mismatch →
// switch-network → insufficient → Burn (with retry on a failed/rejected tx). The
// button also waits for the destination confirmation above it (USDX-661).
function BurnGate({
  order,
  pre,
  burnState,
  burnErrorKey,
  burnInFlight,
  destinationConfirmed,
  onBurn,
}: {
  order: RedeemOrderDetail;
  pre: ReturnType<typeof useRedeemPreconditions>;
  burnState: ReturnType<typeof useRedeemBurn>["burnState"];
  burnErrorKey: string | null;
  burnInFlight: boolean;
  destinationConfirmed: boolean;
  onBurn: () => void;
}) {
  const { t } = useLang();

  if (burnInFlight) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
        <Spinner className="shrink-0 text-primary" />
        {t("redeem.burnProcessing")}
      </p>
    );
  }

  // Resume: the connected wallet must equal the wallet the order is bound to
  // (the scanner only accepts a burn from order.userAddress).
  const walletMatches =
    !!pre.address &&
    !!order.userAddress &&
    pre.address.toLowerCase() === order.userAddress.toLowerCase();

  const burnButton = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      className="w-full"
      onClick={onBurn}
      disabled={burnDisabled({ canBurn: pre.canBurn, walletMatches, destinationConfirmed })}
    >
      {burnState === "error" ? t("redeem.retryBurn") : t("redeem.burnNow")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      {!pre.isConnected ? (
        <Button type="button" variant="brand" size="lg" className="w-full" onClick={pre.connect}>
          {t("btn.connectWallet")}
        </Button>
      ) : !walletMatches ? (
        <p className="flex items-start gap-2 text-sm leading-5 text-destructive-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("redeem.walletMismatch", { address: truncateAddress(order.userAddress, 6) })}
        </p>
      ) : !pre.chainOk ? (
        <>
          <p className="flex items-center gap-2 text-sm text-foreground">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            {t("redeem.wrongNetwork")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={pre.switchNetwork}
            loading={pre.isSwitchingNetwork}
            loadingLabel={t("redeem.switchingNetwork")}
          >
            {t("redeem.switchNetwork")}
          </Button>
        </>
      ) : pre.insufficientBalance ? (
        <p className="flex items-center gap-2 text-sm leading-5 text-destructive-text">
          <AlertTriangle className="size-4 shrink-0" />
          {t("redeem.insufficientBalance")}
        </p>
      ) : (
        <>
          {pre.lowGasWarning && (
            <p className="flex items-center gap-2 text-sm leading-5 text-warning-text">
              <AlertTriangle className="size-4 shrink-0" />
              {t("redeem.lowGas")}
            </p>
          )}
          {burnState === "error" && burnErrorKey && (
            <p role="alert" className="text-sm leading-5 text-destructive-text">
              {t(burnErrorKey)}
            </p>
          )}
          {burnButton}
        </>
      )}
    </div>
  );
}
