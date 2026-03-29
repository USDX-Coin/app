"use client";

import { RedeemForm } from "@/components/redeem/RedeemForm";
import { RedeemReview } from "@/components/redeem/RedeemReview";
import { useRedeemStore } from "@/stores/redeemStore";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RedeemPageContent() {
  const step = useRedeemStore((s) => s.step);
  const setStep = useRedeemStore((s) => s.setStep);
  const reset = useRedeemStore((s) => s.reset);
  const isDesktop = useIsDesktop();

  const isReviewOrLater = step === "review" || step === "executing" || step === "success";

  function handleDialogClose(open: boolean) {
    if (!open) {
      if (step === "review") setStep("form");
      else if (step === "success") reset();
      // "executing" — prevent close by not updating state
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto lg:justify-center">
      {/* Main Form */}
      <div className="flex-1 lg:max-w-[600px]">
        <div className="bg-white p-4 md:p-6 lg:rounded-2xl lg:border lg:border-border lg:shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-primary">Redeem</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">Redeem USDX tokens back to USD. Funds are transferred to your bank account.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <RedeemForm />
        </div>
      </div>

      {/* Review Panel — desktop only side panel */}
      {isReviewOrLater && (
        <div className="hidden lg:block lg:w-96">
          <div className="rounded-2xl border border-border bg-white p-4 md:p-6 shadow-sm">
            <RedeemReview />
          </div>
        </div>
      )}

      {/* Review Modal — mobile/tablet */}
      <Dialog open={isReviewOrLater && !isDesktop} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redeem Detail</DialogTitle>
          </DialogHeader>
          <RedeemReview />
        </DialogContent>
      </Dialog>
    </div>
  );
}
