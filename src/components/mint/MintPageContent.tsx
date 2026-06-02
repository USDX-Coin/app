"use client";

import { useMintStore } from "@/stores/mintStore";
import { PageHeader } from "@/components/shared/PageHeader";
import { MintForm } from "@/components/mint/MintForm";
import { MintConfirmation } from "@/components/mint/MintConfirmation";
import { MintStatus } from "@/components/mint/MintStatus";

const HEADERS = {
  form: { crumbs: ["crumb.transaction", "nav.mint"], title: "title.mint" },
  confirmation: { crumbs: ["crumb.transaction", "nav.mint", "crumb.confirmation"], title: "title.mintConfirmation" },
  status: { crumbs: ["crumb.transaction", "nav.mint", "crumb.status"], title: "title.mintStatus" },
} as const;

export function MintPageContent() {
  const step = useMintStore((s) => s.step);
  const header = HEADERS[step];

  return (
    <div className="flex h-full flex-col gap-2">
      <PageHeader crumbs={[...header.crumbs]} title={header.title} />
      <div className="flex flex-1 justify-center pt-8">
        {step === "form" && <MintForm />}
        {step === "confirmation" && <MintConfirmation />}
        {step === "status" && <MintStatus />}
      </div>
    </div>
  );
}
