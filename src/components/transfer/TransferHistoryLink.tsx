"use client";

// Pintu ke riwayat transfer (USDX-701) dari /send dan /history. Hanya untuk user yang
// punya wallet custodial (dibaca dari profil, tanpa GET tambahan): transfer keluar
// hanya bisa dikirim dari wallet itu, jadi bagi user lain riwayatnya selalu kosong.

import Link from "next/link";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useLang } from "@/providers/LanguageProvider";

export function TransferHistoryLink() {
  const { t } = useLang();
  const wallet = useCustodialWallet();
  if (!wallet.hasWallet) return null;
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/send/history" data-testid="transfer-history-link">
        <History />
        {t("transfer.history.link")}
      </Link>
    </Button>
  );
}
