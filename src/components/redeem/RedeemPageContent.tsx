"use client";

import { RedeemForm } from "@/components/redeem/RedeemForm";
import { RedeemReview } from "@/components/redeem/RedeemReview";
import { useRedeemStore } from "@/stores/redeemStore";
import { Info } from "lucide-react";

export function RedeemPageContent() {
  const step = useRedeemStore((s) => s.step);

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto">
      {/* Main Form */}
      <div className="flex-1">
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-primary">Redeem</h1>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <RedeemForm />
        </div>
      </div>

      {/* Review Panel */}
      {(step === "review" || step === "executing" || step === "success") && (
        <div className="lg:w-96">
          <div className="rounded-2xl border border-border bg-white p-6">
            <RedeemReview />
          </div>
        </div>
      )}
    </div>
  );
}
