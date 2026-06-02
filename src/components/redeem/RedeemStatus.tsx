"use client";

import { useRouter } from "next/navigation";
import { useRedeem } from "@/hooks/useRedeem";
import { useRedeemStore } from "@/stores/redeemStore";
import { useLang } from "@/providers/LanguageProvider";
import { formatAmount } from "@/lib/utils";
import { StatusCard } from "@/components/shared/StatusCard";

export function RedeemStatus() {
  const router = useRouter();
  const { t } = useLang();
  const { selectedChain, selectedBank, parsedAmount, exchangeRateIdr, receiveAmountIdr } = useRedeem();
  const reset = useRedeemStore((s) => s.reset);
  const result = useRedeemStore((s) => s.result);

  const requestId = result ? `#${result.id.toUpperCase()}` : "#—";
  const submitted = result
    ? new Date(result.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <StatusCard
      title={t("status.redeemSubmitted")}
      network={selectedChain?.name}
      requestId={requestId}
      submitted={submitted}
      rows={[
        {
          label: t("sum.youWillRedeem"),
          value: (
            <>
              <img src="/image/usdx-logo.png" alt="" className="size-5 rounded-full" /> USDX
            </>
          ),
        },
        {
          label: t("sum.network"),
          value: (
            <>
              {selectedChain && <img src={selectedChain.icon} alt="" className="size-4 rounded-sm" />}
              {selectedChain?.name}
            </>
          ),
        },
        {
          label: t("sum.bankAccount"),
          value: selectedBank ? `${selectedBank.bankName} · ${selectedBank.accountNumber}` : "—",
        },
        { label: t("sum.exchangeRate"), value: `1 USDX ≈ ${formatAmount(exchangeRateIdr)} IDR` },
        { label: t("sum.amount"), value: `${formatAmount(parsedAmount)} USDX` },
      ]}
      receiveLabel={t("sum.receiveAmount")}
      receiveValue={`${formatAmount(receiveAmountIdr)} IDR`}
      primaryLabel={t("btn.backToRedeem")}
      onPrimary={reset}
      secondaryLabel={t("btn.viewHistory")}
      onSecondary={() => router.push("/transactions")}
    />
  );
}
