"use client";

// Badge status transfer custodial (USDX-701). Status dibaca lewat
// `transferStatusOf`, jadi nilai yang belum dikenal FE tampil sebagai "Menunggu
// konfirmasi" — bukan kode mentah dan bukan pill abu-abu.

import { StatusBadge } from "@/components/ui/status-badge";
import { useLang } from "@/providers/LanguageProvider";
import { transferStatusOf } from "@/lib/wallet-transfer";
import type { WalletTransfer } from "@/types";

export function TransferStatusBadge({ transfer }: { transfer: Pick<WalletTransfer, "status"> }) {
  const { t } = useLang();
  const status = transferStatusOf(transfer);
  return (
    <StatusBadge status={status} data-testid="transfer-status-badge">
      {t(`transfer.status.${status}`)}
    </StatusBadge>
  );
}
