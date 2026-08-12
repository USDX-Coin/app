"use client";

// /mint page (USDX-201). Single form view — the review is a modal and the
// post-create flow hands off (cross-origin) to the checkout repo at
// mint.usdx.co.id (USDX-225), so there's no in-page confirmation/status step.

import { PageHeader } from "@/components/shared/PageHeader";
import { KycStatusSection } from "@/components/kyc/KycStatusSection";
import { MintForm } from "@/components/mint/MintForm";

export function MintPageContent() {
  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={["crumb.transaction", "nav.mint"]} title="title.mint" />
      <KycStatusSection />
      <div className="flex flex-1 justify-center pt-8">
        <MintForm />
      </div>
    </div>
  );
}
