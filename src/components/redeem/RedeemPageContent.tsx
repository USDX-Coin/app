"use client";

import { useRedeemStore } from "@/stores/redeemStore";
import { PageHeader } from "@/components/shared/PageHeader";
import { RedeemForm } from "@/components/redeem/RedeemForm";
import { RedeemConfirmation } from "@/components/redeem/RedeemConfirmation";
import { RedeemStatus } from "@/components/redeem/RedeemStatus";

const HEADERS = {
  form: { crumbs: ["crumb.transaction", "nav.redeem"], title: "title.redeem" },
  confirmation: { crumbs: ["crumb.transaction", "nav.redeem", "crumb.confirmationShort"], title: "title.redeemConfirmation" },
  status: { crumbs: ["crumb.transaction", "nav.redeem", "crumb.status"], title: "title.redeemStatus" },
} as const;

export function RedeemPageContent() {
  const step = useRedeemStore((s) => s.step);
  const header = HEADERS[step];

  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={[...header.crumbs]} title={header.title} />
      <div className="flex flex-1 justify-center pt-8">
        {step === "form" && <RedeemForm />}
        {step === "confirmation" && <RedeemConfirmation />}
        {step === "status" && <RedeemStatus />}
      </div>
    </div>
  );
}
