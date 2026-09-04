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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { parseScannedAddress } from "@/lib/validations";
import { useLang } from "@/providers/LanguageProvider";
import type { IDetectedBarcode, IScannerError } from "@yudiel/react-qr-scanner";

// The camera plate is literally black and its spinner literally white: this is
// the viewfinder, not a surface, and it must not follow the theme — a light-mode
// plate would flash white for the moment before the video stream arrives.
function ScannerLoading() {
  return (
    <div className="flex aspect-square items-center justify-center bg-black">
      <Spinner className="size-6 text-white/70" />
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
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("scan.title")}</DialogTitle>
        </DialogHeader>

        {/* A square viewfinder plus the hint is taller than a 320×568 screen once
            the browser chrome is in; the body scrolls so the hint stays reachable. */}
        <DialogBody className="pb-6">
          {cameraError ? (
            // A camera that cannot start is a state that persists until the user
            // changes something, so it is an Alert, not a toast.
            <Alert tone="warning">{cameraError}</Alert>
          ) : (
            <div className="overflow-hidden rounded-xl bg-black [&_video]:aspect-square [&_video]:w-full [&_video]:object-cover">
              <Scanner
                onScan={handleScan}
                onError={handleError}
                formats={["qr_code"]}
                components={{ finder: true }}
                styles={{ container: { width: "100%" } }}
              />
            </div>
          )}

          <p className="text-center text-xs text-muted-text">{t("scan.hint")}</p>

          {scanError && <Alert tone="danger">{scanError}</Alert>}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
