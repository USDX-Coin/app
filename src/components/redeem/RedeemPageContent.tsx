"use client";

// /redeem page (USDX-243, hardened USDX-259). Two views: the form (with the
// Ringkasan modal + contextual wallet connect over it) and the status tracker.
// Step state lives in redeemStore; the Ringkasan confirm creates the order and
// switches to `tracker`. A `?order=<id>` query (resume from /history, USDX-259)
// loads that order straight into the tracker — works on a fresh load too, so the
// resumed burn is deep-linkable.

import { useEffect } from "react";
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
  const orderId = useRedeemStore((s) => s.orderId);
  const resumeOrder = useRedeemStore((s) => s.resumeOrder);

  // Resume from /history: ?order=<id> opens the tracker for that order even on a
  // fresh load (the store is empty then). Strip the param afterwards so a refresh
  // doesn't re-trigger it. Runs client-side only (no Suspense needed).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    if (id && id !== orderId) {
      resumeOrder(id);
      window.history.replaceState(null, "", "/redeem");
    }
  }, [orderId, resumeOrder]);

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
