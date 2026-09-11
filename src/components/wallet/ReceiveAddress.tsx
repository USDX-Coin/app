"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

const COPIED_MS = 2_000;

/**
 * The custodial wallet's address, shown the way the ticket asks for it: as a
 * "receiving address" with a QR code and a copy button — never as a bare hex
 * string someone is expected to read. The full 42 characters stay behind a
 * "show full address" toggle for the few who want them; the QR and the copy
 * button carry the address for everyone else (USDX-566 § Copy UX).
 *
 * Only ever rendered for an ACTIVE wallet: during PROVISIONING the address is
 * null by contract (wallet.yaml § CustodialWallet), so the caller gates on
 * status, not on "is there a wallet".
 */
export function ReceiveAddress({ address }: { address: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Clipboard denied (insecure context / permission). The QR and the full
      // address are still on screen, so there is nothing to alarm about.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <div data-slot="receive-address" className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {/* White frame in both themes: QR readers want dark modules on a light
          ground, and a dark-theme card would invert that contrast. */}
      <div className="flex shrink-0 justify-center rounded-xl border border-border bg-white p-3 sm:justify-start">
        <QRCodeSVG
          value={address}
          size={144}
          level="M"
          role="img"
          aria-label={t("wallet.receive.qrAlt")}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t("wallet.receive.title")}</p>
        <p className="text-sm text-muted-text">{t("wallet.receive.hint")}</p>
        <code
          data-slot="receive-address-value"
          className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all text-foreground"
        >
          {showFull ? address : truncateAddress(address, 6)}
        </code>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy} aria-live="polite">
            {copied ? <Check /> : <Copy />}
            {copied ? t("wallet.receive.copied") : t("wallet.receive.copy")}
          </Button>
          <Button variant="link" size="sm" onClick={() => setShowFull((v) => !v)}>
            {showFull ? t("wallet.receive.hideFull") : t("wallet.receive.showFull")}
          </Button>
        </div>
      </div>
    </div>
  );
}
