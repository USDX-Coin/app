import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { KycMyStatus } from "@/types";

// Renders the KYC status banner (sot/phase-2/week1.md § Consumer App Flow):
// PENDING / VERIFIED / REJECTED (+ reason). UNVERIFIED shows nothing — the form is the CTA.
export function KycStatusBanner({ status }: { status: KycMyStatus }) {
  if (status.status === "UNVERIFIED") return null;

  if (status.status === "VERIFIED") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">Your identity is verified</p>
          <p className="text-sm opacity-90">You can now access all features.</p>
        </div>
      </div>
    );
  }

  if (status.status === "PENDING") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
        <Clock className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">Verification in review</p>
          <p className="text-sm opacity-90">
            We&apos;re reviewing your documents. This usually takes 1–2 business days.
          </p>
        </div>
      </div>
    );
  }

  // REJECTED
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-200">
      <XCircle className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-medium">Verification rejected</p>
        {status.rejectionReason && (
          <p className="text-sm opacity-90">{status.rejectionReason}</p>
        )}
        <p className="text-sm opacity-90">Please review and submit again below.</p>
      </div>
    </div>
  );
}
