import { PageHeader } from "@/components/shared/PageHeader";
import { TransferDetail } from "@/components/transfer/TransferDetail";

// /send/history/[id] — detail + tracker satu transfer custodial (USDX-701,
// wallet.yaml § transfer-detail). `id` = `TransferAccepted.id` / item riwayat.
export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        crumbs={["crumb.transaction", "nav.send", "transfer.history.title"]}
        title="transfer.detail.title"
      />
      <TransferDetail id={id} />
    </div>
  );
}
