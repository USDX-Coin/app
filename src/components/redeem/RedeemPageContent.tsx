"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RedeemForm } from "@/components/redeem/RedeemForm";

export function RedeemPageContent() {
  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={["crumb.transaction", "nav.redeem"]} title="title.redeem" />
      <div className="flex flex-1 justify-center pt-8">
        <RedeemForm />
      </div>
    </div>
  );
}
