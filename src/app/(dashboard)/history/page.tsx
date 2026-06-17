import { PageHeader } from "@/components/shared/PageHeader";
import { TransactionList } from "@/components/transactions/TransactionList";

export default function HistoryPage() {
  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader crumbs={["sidebar.more", "nav.history"]} title="title.transactionHistory" />
      <TransactionList />
    </div>
  );
}
