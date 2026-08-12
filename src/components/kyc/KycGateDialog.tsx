"use client";

import { useRouter } from "next/navigation";
import { Clock, ShieldAlert, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/providers/LanguageProvider";
import type { KycStatus } from "@/types";

interface KycGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: KycStatus;
  rejectionReason?: string | null;
}

// Per-status dialog opened by useKycGate when a non-VERIFIED user triggers a
// transaction action (USDX-153). UNVERIFIED → complete KYC; PENDING → in review;
// REJECTED → reason + resubmit. Never opens for VERIFIED.
export function KycGateDialog({
  open,
  onOpenChange,
  status,
  rejectionReason,
}: KycGateDialogProps) {
  const router = useRouter();
  const { t } = useLang();

  if (status === "VERIFIED") return null;

  const content =
    status === "PENDING"
      ? {
          icon: <Clock className="size-6 text-amber-500" />,
          title: t("kyc.lock.pendingTitle"),
          body: t("kyc.lock.pendingBody"),
          cta: null,
        }
      : status === "REJECTED"
        ? {
            icon: <XCircle className="size-6 text-destructive" />,
            title: t("kyc.lock.rejectedTitle"),
            body: rejectionReason ?? t("kyc.lock.rejectedBody"),
            cta: t("kyc.lock.resubmit"),
          }
        : {
            icon: <ShieldAlert className="size-6 text-amber-500" />,
            title: t("kyc.lock.unverifiedTitle"),
            body: t("kyc.lock.unverifiedBody"),
            cta: t("kyc.lock.completeKyc"),
          };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          {content.icon}
          <DialogTitle className="text-lg font-medium text-foreground">
            {content.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{content.body}</p>
          <div className="mt-2 flex w-full flex-col gap-2">
            {content.cta && (
              <Button
                type="button"
                className="brand-gradient w-full text-white"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/kyc");
                }}
              >
                {content.cta}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              {t("kyc.lock.dismiss")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
