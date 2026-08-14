import { PageHeader } from "@/components/shared/PageHeader";
import { TransactionList } from "@/components/transactions/TransactionList";

export default function HistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader crumbs={["sidebar.more", "nav.history"]} title="title.transactionHistory" />
      <TransactionList />
    </div>
  );
}
