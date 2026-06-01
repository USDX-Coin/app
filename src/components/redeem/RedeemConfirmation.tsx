"use client";

import { useRedeem } from "@/hooks/useRedeem";
import { useLang } from "@/providers/LanguageProvider";
import { formatAmount } from "@/lib/utils";
import { ConfirmationCard } from "@/components/shared/ConfirmationCard";

export function RedeemConfirmation() {
  const { t } = useLang();
  const {
    selectedChain,
    selectedBank,
    parsedAmount,
    exchangeRateIdr,
    receiveAmountIdr,
    backToForm,
    proceedRedeem,
    isProcessing,
  } = useRedeem();

  return (
    <ConfirmationCard
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
      onCancel={backToForm}
      onConfirm={proceedRedeem}
      loading={isProcessing}
    />
  );
}
