"use client";

import { RedeemForm } from "@/components/redeem/RedeemForm";
import { RedeemReview } from "@/components/redeem/RedeemReview";
import { useRedeemStore } from "@/stores/redeemStore";
import { Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRedeem } from "@/hooks/useRedeem";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RedeemPageContent() {
  const step = useRedeemStore((s) => s.step);
  const { goBackToForm } = useRedeem();

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto">
      {/* Main Form */}
      <div className="flex-1">
        <div className="rounded-2xl border border-border bg-white p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-primary">Redeem</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">Redeem USDX tokens back to USD. Funds are transferred to your bank account.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <RedeemForm />
        </div>

        {(step === "review" || step === "executing" || step === "success") && (
          <Button
            onClick={goBackToForm}
            variant="outline"
            className="w-full mt-4 rounded-xl py-5 text-base flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Change Amount
          </Button>
        )}
      </div>

      {/* Review Panel */}
      {(step === "review" || step === "executing" || step === "success") && (
        <div className="lg:w-96">
          <div className="rounded-2xl border border-border bg-white p-4 md:p-6 shadow-sm">
            <RedeemReview />
          </div>
        </div>
      )}
    </div>
  );
}
