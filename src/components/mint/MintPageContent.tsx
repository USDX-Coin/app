"use client";

// /mint page (USDX-201). Single form view — the review is a modal and the
// post-create flow hands off (cross-origin) to the checkout repo at
// mint.usdx.co.id (USDX-225), so there's no in-page confirmation/status step.
// Coming *back* from that handoff (Back button → bfcache restore) is cleaned up
// here, at page level, by `useMintHandoffReset`.

import { PageHeader } from "@/components/shared/PageHeader";
import { KycStatusSection } from "@/components/kyc/KycStatusSection";
import { MintForm } from "@/components/mint/MintForm";
import { useMintHandoffReset } from "@/hooks/useMintHandoffReset";

export function MintPageContent() {
  useMintHandoffReset();

  return (
    <div className="flex flex-1 flex-col gap-2">
      <PageHeader crumbs={["crumb.transaction", "nav.mint"]} title="title.mint" />
      <KycStatusSection />
      {/* `items-start`: this row only centers horizontally — without it the
          default `stretch` pulls the form card down to the bottom of the card. */}
      <div className="flex flex-1 items-start justify-center pt-8">
        <MintForm />
      </div>
    </div>
  );
}
