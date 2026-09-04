"use client";

import { useRouter } from "next/navigation";
import { Clock, ShieldAlert, XCircle } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  // Tone tokens, not palette numbers: the icon is the only colour in this dialog
  // and it has to keep meaning the same thing after a theme switch.
  const content =
    status === "PENDING"
      ? {
          icon: <Clock className="size-6 text-warning" />,
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
            icon: <ShieldAlert className="size-6 text-warning" />,
            title: t("kyc.lock.unverifiedTitle"),
            body: t("kyc.lock.unverifiedBody"),
            cta: t("kyc.lock.completeKyc"),
          };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <span aria-hidden className="shrink-0">
            {content.icon}
          </span>
          <DialogTitle>{content.title}</DialogTitle>
        </DialogHeader>

        {/* A rejection reason comes from a reviewer and has no length limit, so
            the body scrolls rather than pushing the buttons out of reach. */}
        <DialogBody>
          <p className="text-sm text-muted-text">{content.body}</p>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            {t("kyc.lock.dismiss")}
          </Button>
          {content.cta && (
            <Button
              variant="brand"
              size="lg"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                router.push("/kyc");
              }}
            >
              {content.cta}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
