"use client";

import { MintForm } from "@/components/mint/MintForm";
import { MintReview } from "@/components/mint/MintReview";
import { useMintStore } from "@/stores/mintStore";
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

export function MintPageContent() {
  const step = useMintStore((s) => s.step);
  const setStep = useMintStore((s) => s.setStep);
  const isDesktop = useIsDesktop();

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto">
      {/* Main Form */}
      <div className="flex-1">
        <div className="bg-white p-4 md:p-6 lg:rounded-2xl lg:border lg:border-border lg:shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary">Mint</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Mint USDX by sending USD payment. Tokens are delivered to your wallet within 24 hours.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="rounded-full bg-foreground text-white px-4 py-1.5 text-sm font-medium">
              Regular
            </div>
          </div>
          <MintForm />
        </div>
      </div>

      {/* Review Panel — desktop only side panel */}
      {step === "review" && (
        <div className="hidden lg:block lg:w-96">
          <div className="rounded-2xl border border-border bg-white p-4 md:p-6 shadow-sm">
            <MintReview />
          </div>
          <MintNotes />
        </div>
      )}

      {/* Review Modal — mobile/tablet */}
      <Dialog
        open={step === "review" && !isDesktop}
        onOpenChange={(open) => { if (!open) setStep("form"); }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mint Detail</DialogTitle>
          </DialogHeader>
          <MintReview />
          <MintNotes />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MintNotes() {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Please Note</h3>
      <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
        <li>The balance will be credited to your wallet max 24 hours after payment.</li>
        <li>Minimum transaction is $10.</li>
        <li>Transaction will be automatically canceled if payment is not made within 24 hours.</li>
        <li>Maximum transaction is $1,000,000.</li>
      </ul>
    </div>
  );
}
