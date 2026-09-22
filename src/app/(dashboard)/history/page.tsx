import { PageHeader } from "@/components/shared/PageHeader";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransferHistoryLink } from "@/components/transfer/TransferHistoryLink";

// Riwayat mint + redeem. Transfer custodial punya resource sendiri (bukan bagian
// GET /api/v2/transactions, wallet.yaml § RIWAYAT & STATUS TRANSFER), jadi pemilik
// wallet mendapat tautan ke /send/history, bukan tab ketiga (USDX-701).
export default function HistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader crumbs={["sidebar.more", "nav.history"]} title="title.transactionHistory" />
      <div className="flex justify-end empty:hidden">
        <TransferHistoryLink />
      </div>
      <TransactionList />
    </div>
  );
}
