"use client";

// QR scanner for a wallet address (USDX-217, week2.md § Address Book). Opens the
// camera, decodes QR codes, and returns a valid EVM address via onScanned. Reused
// by the Add Wallet modal and the mint "To" field.
//
// - Accepts a bare 0x… address or an EIP-681 "ethereum:0x…" URI (parseScannedAddress).
// - A QR that isn't a valid EVM address → inline error, keeps scanning.
// - Camera failures (denied / no camera / insecure context) → friendly message;
//   manual entry remains available behind the dialog.
// - The Scanner is loaded client-only (next/dynamic, ssr:false) since it touches
//   browser camera APIs; radix unmounts it on close, which stops the camera.

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { parseScannedAddress } from "@/lib/validations";
import { useLang } from "@/providers/LanguageProvider";
import type { IDetectedBarcode, IScannerError } from "@yudiel/react-qr-scanner";

function ScannerLoading() {
  return (
    <div className="flex aspect-square items-center justify-center bg-black">
      <Loader2 className="size-6 animate-spin text-white/70" />
    </div>
  );
}

const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), {
  ssr: false,
  loading: () => <ScannerLoading />,
});

function cameraErrorKey(kind: IScannerError["kind"]): string {
  switch (kind) {
    case "permission-denied":
    case "security":
      return "scan.errPermission";
    case "no-camera":
      return "scan.errNoCamera";
    case "insecure-context":
    case "unsupported":
      return "scan.errInsecure";
    default:
      return "scan.errGeneric";
  }
}

interface AddressScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a valid EVM address once a QR code is successfully decoded. */
  onScanned: (address: string) => void;
}

export function AddressScannerDialog({ open, onOpenChange, onScanned }: AddressScannerDialogProps) {
  const { t } = useLang();
  // A decoded QR that isn't an EVM address (we keep scanning).
  const [scanError, setScanError] = useState<string | null>(null);
  // The camera couldn't start (denied / missing / insecure) — no live view.
  const [cameraError, setCameraError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setScanError(null);
      setCameraError(null);
    }
    onOpenChange(next);
  }

  function handleScan(codes: IDetectedBarcode[]) {
    const raw = codes[0]?.rawValue;
    if (!raw) return;
    const address = parseScannedAddress(raw);
    if (address) {
      setScanError(null);
      onScanned(address);
      handleOpenChange(false);
    } else {
      setScanError(t("scan.errNotAddress"));
    }
  }

  function handleError(error: IScannerError) {
    setCameraError(t(cameraErrorKey(error.kind)));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogTitle className="text-base font-medium text-foreground">
          {t("scan.title")}
        </DialogTitle>

        <div className="mt-2 flex flex-col gap-3">
          {cameraError ? (
            <p className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
              {cameraError}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg bg-black [&_video]:aspect-square [&_video]:w-full [&_video]:object-cover">
              <Scanner
                onScan={handleScan}
                onError={handleError}
                formats={["qr_code"]}
                components={{ finder: true }}
                styles={{ container: { width: "100%" } }}
              />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">{t("scan.hint")}</p>

          {scanError && (
            <p role="alert" className="text-center text-sm text-destructive">
              {scanError}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
