"use client";

// Backup code 2FA — ditampilkan SEKALI (two-factor.yaml § TwoFactorEnroll dan §
// regenerateBackupCodes, USDX-714). Dipakai dialog Aktifkan 2FA dan Backup code
// baru. User bisa menyalin atau mengunduhnya sebagai .txt, lalu menyatakan sudah
// menyimpan (centang) — pemanggil yang memutuskan langkah apa yang terbuka sesudah
// centang. Kode tidak pernah disimpan di storage mana pun oleh app.

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxField } from "@/components/ui/checkbox";
import { useLang } from "@/providers/LanguageProvider";

const COPIED_MS = 2_000;
const FILE_NAME = "usdx-backup-codes.txt";

export interface BackupCodesPanelProps {
  codes: string[];
  saved: boolean;
  onSavedChange: (saved: boolean) => void;
}

export function BackupCodesPanel({ codes, saved, onSavedChange }: BackupCodesPanelProps) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard ditolak (konteks tidak aman / izin): kodenya tetap di layar dan
      // bisa diunduh — tidak ada yang perlu dikabarkan.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`USDX\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-slot="backup-codes" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("twoFactor.backup.title")}</p>
        <p className="text-sm text-muted-text">{t("twoFactor.backup.desc")}</p>
      </div>
      <ul
        data-testid="backup-codes-list"
        className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 font-mono text-sm text-foreground"
      >
        {codes.map((code) => (
          <li key={code} className="text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy} aria-live="polite">
          {copied ? <Check /> : <Copy />}
          {copied ? t("twoFactor.backup.copied") : t("twoFactor.backup.copy")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download />
          {t("twoFactor.backup.download")}
        </Button>
      </div>
      <CheckboxField htmlFor="backup-codes-saved" className="items-center gap-3">
        <Checkbox
          id="backup-codes-saved"
          checked={saved}
          onCheckedChange={(checked) => onSavedChange(checked === true)}
        />
        <span className="py-2 text-sm text-foreground">{t("twoFactor.backup.saved")}</span>
      </CheckboxField>
    </div>
  );
}
