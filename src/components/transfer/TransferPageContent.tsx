"use client";

// /send (USDX-567). Dua wajah, dipilih dari profil user:
//   - punya wallet custodial (`user.custodialWallet`) → form transfer custodial;
//   - tidak punya → ComingSoon yang sama seperti sebelumnya. "Kirim dari wallet
//     eksternal" belum punya backend (UI lamanya memalsukan sukses lokal, dihapus
//     13 Agu), dan onboarding "dikasih wallet" adalah USDX-566 — bukan tiket ini.
// Keputusan dibaca dari ringkasan di profil supaya tidak ada kedipan: user
// non-custodial tidak menunggu GET /api/v2/wallet hanya untuk melihat ComingSoon.

import { PageHeader } from "@/components/shared/PageHeader";
import { ComingSoonPage } from "@/components/shared/ComingSoonPage";
import { KycStatusSection } from "@/components/kyc/KycStatusSection";
import { TransferForm } from "@/components/transfer/TransferForm";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";

export function TransferPageContent() {
  const wallet = useCustodialWallet();

  if (!wallet.hasWallet) {
    return (
      <ComingSoonPage
        crumbs={["crumb.transaction", "nav.send"]}
        titleKey="nav.send"
        headlineKey="soon.send.headline"
        descKey="soon.send.desc"
        meanwhileKey="soon.send.meanwhile"
        primary={{ labelKey: "soon.toMint", href: "/mint" }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <PageHeader crumbs={["crumb.transaction", "nav.send"]} title="title.send" />
      <KycStatusSection />
      {/* `items-start`: baris ini hanya memusatkan horizontal — tanpa itu
          `stretch` menarik kartu form sampai ke dasar halaman. */}
      <div className="flex flex-1 items-start justify-center pt-8">
        <TransferForm />
      </div>
    </div>
  );
}
