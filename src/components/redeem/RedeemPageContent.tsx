"use client";

// /redeem page (USDX-243). Two views: the form (with the Ringkasan modal +
// contextual wallet connect over it) and the status tracker. Step state lives in
// redeemStore; the Ringkasan confirm creates the order and switches to `tracker`.

import { useRedeemStore } from "@/stores/redeemStore";
import { PageHeader } from "@/components/shared/PageHeader";
import { RedeemForm } from "@/components/redeem/RedeemForm";
import { RedeemStatus } from "@/components/redeem/RedeemStatus";

const HEADERS = {
  form: { crumbs: ["crumb.transaction", "nav.redeem"], title: "title.redeem" },
  tracker: { crumbs: ["crumb.transaction", "nav.redeem", "crumb.status"], title: "title.redeemStatus" },
} as const;

export function RedeemPageContent() {
  const step = useRedeemStore((s) => s.step);
  const header = HEADERS[step];

  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={[...header.crumbs]} title={header.title} />
      <div className="flex flex-1 justify-center pt-8">
        {step === "form" && <RedeemForm />}
        {step === "tracker" && <RedeemStatus />}
      </div>
    </div>
  );
}
