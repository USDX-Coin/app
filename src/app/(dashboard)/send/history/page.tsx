import { PageHeader } from "@/components/shared/PageHeader";
import { TransferHistoryList } from "@/components/transfer/TransferHistoryList";

// /send/history — riwayat transfer keluar dari wallet custodial (USDX-701,
// wallet.yaml § transfers). Tinggal di bawah /send supaya sidebar tetap menandai
// "Send". User tanpa wallet mendapat daftar kosong dari API (200), bukan galat.
export default function TransferHistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        crumbs={["crumb.transaction", "nav.send", "transfer.history.title"]}
        title="transfer.history.title"
      />
      <TransferHistoryList />
    </div>
  );
}
